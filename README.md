# Nexcart — Production Microservices E-Commerce

A full production-grade microservices e-commerce platform demonstrating every key backend architecture pattern used in real-world systems.

## Architecture Highlights

| Pattern | Implementation |
|---|---|
| **API Gateway** | Custom Express gateway — JWT auth, rate limiting, request routing |
| **Microservices** | 7 independent services, each owning its own data |
| **Authentication** | JWT with refresh token rotation + Redis blacklist |
| **Rate Limiting** | Redis-backed sliding window per user/IP |
| **Redis Caching** | Cache-aside pattern on product catalog, TTL-based invalidation |
| **Cart Store** | Pure Redis — ephemeral, sub-ms, auto-expiring |
| **Event-Driven** | RabbitMQ topic exchange — order → payment → notification pipeline |
| **Circuit Breaker** | Opossum wrapping Stripe API — open/half-open/closed states |
| **Database per Service** | PostgreSQL (4 services), MongoDB (products), Redis (cart) |
| **Docker** | Multi-stage builds, docker-compose for local + prod |
| **AWS** | EC2, RDS, ElastiCache, Amazon MQ, S3, ALB, Route 53 |

---

## Services

```
PORT   SERVICE               DATABASE        KEY TECH
3000   API Gateway           Redis           Rate limiting, JWT verify, proxy
3001   Auth Service          PostgreSQL      JWT, bcrypt, refresh tokens
3002   User Service          PostgreSQL      Profiles, addresses
3003   Product Service       MongoDB         Redis caching, text search
3004   Cart Service          Redis (only)    Hash-based cart, TTL
3005   Order Service         PostgreSQL      RabbitMQ publisher
3006   Payment Service       PostgreSQL      Stripe, Circuit Breaker, webhooks
3007   Notification Service  —               RabbitMQ consumer, nodemailer
```

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+

### 1. Clone & configure

```bash
git clone https://github.com/yourname/shopflow
cd shopflow

# Copy env files for each service
for dir in gateway services/auth-service services/user-service services/product-service services/cart-service services/order-service services/payment-service services/notification-service; do
  cp $dir/.env.example $dir/.env
done

cp client/.env.local.example client/.env.local
```

### 2. Add your Stripe test keys

Edit `services/payment-service/.env`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Edit `client/.env.local`:
```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3. Start everything

```bash
docker-compose up --build
```

### 4. Seed products

```bash
cd services/product-service
npx ts-node ../../scripts/seed.ts
```

### 5. Open

| URL | Service |
|---|---|
| http://localhost:80 | Frontend (via Nginx) |
| http://localhost:3000 | API Gateway |
| http://localhost:15672 | RabbitMQ Management UI |

RabbitMQ credentials: `shopflow` / `shopflow_secret`

---

## API Reference

### Auth
```
POST /api/auth/register    { email, password, name }
POST /api/auth/login       { email, password }
POST /api/auth/refresh     { refreshToken }
POST /api/auth/logout
GET  /api/auth/me
```

### Products
```
GET  /api/products         ?page, limit, category, search, minPrice, maxPrice
GET  /api/products/:id
POST /api/products         (admin) { name, price, category, inventory, ... }
PUT  /api/products/:id     (admin)
DELETE /api/products/:id   (admin)
```

### Cart
```
GET    /api/cart
POST   /api/cart/items     { productId, name, price, quantity, image }
PUT    /api/cart/items/:productId  { quantity }
DELETE /api/cart/items/:productId
DELETE /api/cart
```

### Orders
```
GET  /api/orders           ?page, limit
GET  /api/orders/:id
POST /api/orders           { items, shippingAddress }
PATCH /api/orders/:id/cancel
```

### Payments
```
POST /api/payments/intent  { orderId, amount, currency }
POST /api/payments/webhook (Stripe webhook)
GET  /api/payments/order/:orderId
POST /api/payments/:id/refund
GET  /api/payments/circuit-status
```

---

## Event Flow

```
Order placed
    → RabbitMQ: order.placed
        → Payment Service: logs/prepares
        → Notification: "Order received" email

Payment confirmed (Stripe webhook)
    → RabbitMQ: payment.success
        → Order Service: status PENDING → CONFIRMED
        → Notification: "Payment confirmed" email

Payment failed
    → RabbitMQ: payment.failed
        → Order Service: status → CANCELLED
        → Notification: "Payment failed" email
```

---

## AWS Production Deployment

See [docs/AWS_DEPLOYMENT.md](docs/AWS_DEPLOYMENT.md) for the complete step-by-step guide covering:
- VPC, subnets, security groups
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis
- Amazon MQ (RabbitMQ)
- EC2 + Auto Scaling Group
- Application Load Balancer
- Route 53 + ACM (SSL)
- ECR (container registry)
- GitHub Actions CI/CD
- AWS Secrets Manager

---

## Tech Stack

**Backend:** Node.js, TypeScript, Express.js  
**ORM:** Prisma (PostgreSQL), Mongoose (MongoDB)  
**Databases:** PostgreSQL, MongoDB, Redis  
**Messaging:** RabbitMQ (amqplib)  
**Payments:** Stripe  
**Circuit Breaker:** Opossum  
**Frontend:** Next.js 14, React, Tailwind CSS, TanStack Query, Zustand  
**Infrastructure:** Docker, nginx, AWS (EC2, RDS, ElastiCache, Amazon MQ, S3, ALB)  
**CI/CD:** GitHub Actions  

---

## Project Structure

```
shopflow/
├── docker-compose.yml
├── docker-compose.prod.yml
├── gateway/                    API Gateway
├── services/
│   ├── auth-service/
│   ├── user-service/
│   ├── product-service/
│   ├── cart-service/
│   ├── order-service/
│   ├── payment-service/
│   └── notification-service/
├── client/                     Next.js frontend
├── shared/                     Shared types, constants, utils
├── infrastructure/
│   ├── nginx/
│   └── scripts/
├── scripts/
│   └── seed.ts
└── docs/
    ├── architecture.md
    └── AWS_DEPLOYMENT.md
```