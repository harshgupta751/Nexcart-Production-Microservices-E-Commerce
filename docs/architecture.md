# ShopFlow — Architecture Documentation

## System Overview

ShopFlow is a production-grade e-commerce platform demonstrating microservices architecture
with API Gateway, event-driven communication, caching, circuit breaking, and full AWS deployment.

---

## Service Map

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT (Next.js)                        │
│  React Query · Zustand · Stripe.js · Tailwind CSS           │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY  (Express — Port 3000)             │
│  ✓ JWT Verification      ✓ Rate Limiting (Redis)            │
│  ✓ Request Routing       ✓ Header Injection (X-User-*)      │
│  ✓ CORS / Helmet         ✓ Centralized Logging              │
└──┬──────┬──────┬──────┬──────┬──────┬──────────────────────┘
   │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼
 AUTH   USER  PRODUCT  CART  ORDER  PAYMENT
 :3001  :3002   :3003  :3004  :3005  :3006
   │      │      │      │      │      │
   │      │      │      │      │      └── Circuit Breaker
   │      │      │      │      │          (Opossum → Stripe)
   │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼
  PG    PG     MongoDB  Redis  PG+MQ    PG+MQ
  auth  users  products carts  orders   payments
```

---

## Request Flow: Place Order

```
1. User clicks "Checkout"
        │
2. POST /api/orders  ──► API Gateway
        │                 ├── Verify JWT
        │                 ├── Check token blacklist (Redis)
        │                 ├── Check rate limit (Redis)
        │                 └── Inject X-User-Id header
        │
3.      ──► Order Service
              ├── Validate request body
              ├── Calculate subtotal + tax + shipping
              ├── Create order (Prisma transaction)
              │     └── order + items + address (atomic)
              │
              ├── PUBLISH → RabbitMQ
              │     Exchange: order.exchange
              │     Key:      order.placed
              │     Payload:  { orderId, userId, items, total }
              │
              └── ASYNC: clear user's Redis cart

4. RabbitMQ routes order.placed event:
        │
        ├──► Payment Service consumes (logs/prepares)
        │
        └──► Notification Service sends "Order Received" email

5. Client calls POST /api/payments/intent
        │
        └──► Payment Service
              ├── stripeClient.createPaymentIntent()  ← Circuit Breaker wrapped
              │     CB: timeout=5s, errorThreshold=50%, resetTimeout=30s
              │     Fallback: ServiceUnavailableError
              │
              └── Returns { clientSecret } to client

6. Client confirms payment via Stripe.js

7. Stripe webhook → POST /api/payments/webhook
        │
        └──► Payment Service
              ├── Verify Stripe signature
              ├── Update payment status in DB
              │
              ├── PUBLISH → payment.exchange → payment.success
              │
              ├── Order Service consumes payment.success
              │     └── Updates order status: PENDING → CONFIRMED
              │
              └── Notification Service consumes payment.success
                    └── Sends "Payment Confirmed" email
```

---

## Redis Usage (3 Distinct Patterns)

### 1. Rate Limiting (API Gateway)
```
Key pattern: rl:general:{userId|ip}
Key pattern: rl:auth:{ip}
Key pattern: rl:payment:{userId}

Window: sliding 60s
Limit:  100 req/min (general), 10 (auth), 5/15min (payment)
Store:  rate-limit-redis store
```

### 2. Product Caching (Product Service)
```
Key pattern: product:{id}               TTL: 300s
Key pattern: products:list:{page}:{limit}:{category}  TTL: 180s

Cache-Aside pattern:
  GET → check Redis → if miss: query MongoDB → store → return
  POST/PUT/DELETE → invalidate related keys via SCAN + DEL
```

### 3. Cart Storage (Cart Service)
```
Key pattern: cart:{userId}    TTL: 86400s (24h)

Pure Redis (no DB) — cart is ephemeral:
  Hash-style JSON blob serialized per user
  Cleared on order placement
  Auto-expires after 24h inactivity
```

### 4. Auth (Token Management)
```
Key pattern: refresh:{userId}        TTL: 604800s (7 days)
Key pattern: blacklist:{accessToken} TTL: remaining token lifetime

Refresh tokens stored → enables rotation + invalidation
Blacklisted tokens → enables logout before expiry
```

---

## RabbitMQ Event Bus

```
EXCHANGES (topic type, durable):
  order.exchange
  payment.exchange
  notification.exchange
  user.exchange

BINDINGS:
  order.exchange    → order.placed      → payment.process.queue (Payment Service)
  order.exchange    → order.placed      → notification.email.queue (Notification)
  payment.exchange  → payment.success   → payment.success.queue (Order Service)
  payment.exchange  → payment.failed    → payment.failed.queue (Order Service)
  payment.exchange  → payment.*         → notification.email.queue (Notification)
  user.exchange     → user.registered   → notification.email.queue (Notification)

MESSAGE GUARANTEES:
  persistent: true       → survives broker restart
  durable queues         → survive restart
  prefetch: 1            → at-most-once concurrent processing
  nack + requeue         → retry on failure
  DLQ (dlq.exchange)     → dead letters after redelivery
  x-message-ttl: 86400000 → 24h max age
```

---

## Circuit Breaker (Payment → Stripe)

```
Library: opossum

States:
  CLOSED    → Normal operation, all calls go through
  OPEN      → Short-circuit: calls fail immediately with fallback
  HALF-OPEN → Test mode: 1 call allowed to probe recovery

Config:
  timeout:              5000ms   (Stripe call must respond in 5s)
  errorThresholdPct:    50%      (open after 50% failures)
  resetTimeout:         30000ms  (retry after 30s)
  volumeThreshold:      5        (min 5 calls before tracking)

Fallback: throws ServiceUnavailableError → 503 response
Monitoring: /api/payments/circuit-status → returns live stats

Events logged:
  open      → ERROR log (PagerDuty alert in prod)
  halfOpen  → WARN log
  close     → INFO log (recovery)
  timeout   → WARN log
  reject    → WARN log (circuit open, rejected)
```

---

## Database Per Service

| Service | Database | Reason |
|---|---|---|
| Auth | PostgreSQL (auth_db) | ACID, relational user identity |
| User | PostgreSQL (user_db) | Structured profiles, addresses |
| Product | MongoDB (product_db) | Flexible schema, nested variants/specs |
| Cart | Redis | Ephemeral, sub-millisecond, auto-expire |
| Order | PostgreSQL (order_db) | Transactional, financial records |
| Payment | PostgreSQL (payment_db) | Strict consistency, audit trail |

---

## Security

- **JWT**: RS256, 15-min access tokens, 7-day refresh tokens with rotation
- **Token blacklist**: Redis-backed, enables immediate logout
- **Passwords**: bcrypt with 12 rounds
- **Stripe webhooks**: Signature verification (Stripe-Signature header)
- **Rate limiting**: Redis-backed, per-user + per-IP
- **CORS**: Allowlist-based origin validation
- **Helmet**: Security headers on all services
- **Database**: Private subnets, no public access
- **Secrets**: AWS Secrets Manager in production

---

## Project Structure

```
shopflow/
├── docker-compose.yml          # Local dev (all services + infra)
├── docker-compose.prod.yml     # Production overrides
├── package.json                # npm workspaces root
├── tsconfig.base.json          # Shared TS config
│
├── shared/                     # @shopflow/shared
│   ├── types/index.ts          # All domain interfaces & enums
│   ├── constants/index.ts      # Queue names, cache keys, ports
│   └── utils/index.ts          # Logger, error classes, helpers
│
├── gateway/                    # API Gateway (port 3000)
│   └── src/
│       ├── index.ts            # Express app + bootstrap
│       ├── routes/index.ts     # Proxy route definitions
│       ├── middleware/
│       │   ├── auth.middleware.ts         # JWT verification
│       │   ├── rate-limit.middleware.ts   # Redis rate limiting
│       │   ├── error.middleware.ts
│       │   └── request-logger.middleware.ts
│       └── utils/redis.ts
│
├── services/
│   ├── auth-service/           # JWT auth (port 3001) — PostgreSQL
│   ├── user-service/           # Profiles (port 3002) — PostgreSQL
│   ├── product-service/        # Catalog (port 3003) — MongoDB + Redis
│   ├── cart-service/           # Cart (port 3004) — Redis only
│   ├── order-service/          # Orders (port 3005) — PostgreSQL + RabbitMQ
│   ├── payment-service/        # Stripe + Circuit Breaker (port 3006)
│   └── notification-service/   # Email consumer (port 3007)
│
├── client/                     # Next.js 14 frontend
│   └── src/
│       ├── app/                # App Router pages
│       ├── components/         # UI components
│       └── lib/                # API client, Zustand stores
│
├── infrastructure/
│   ├── nginx/nginx.conf
│   └── scripts/create-multiple-db.sh
│
└── docs/
    ├── architecture.md          # This file
    └── AWS_DEPLOYMENT.md        # Full AWS deployment guide
```