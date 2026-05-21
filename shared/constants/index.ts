export const EXCHANGES = {
  ORDER: 'order.exchange',
  PAYMENT: 'payment.exchange',
  NOTIFICATION: 'notification.exchange',
  USER: 'user.exchange',
} as const;

export const QUEUES = {
  ORDER_PLACED: 'order.placed.queue',
  ORDER_CONFIRMED: 'order.confirmed.queue',
  ORDER_CANCELLED: 'order.cancelled.queue',
  PAYMENT_PROCESS: 'payment.process.queue',
  PAYMENT_SUCCESS: 'payment.success.queue',
  PAYMENT_FAILED: 'payment.failed.queue',
  NOTIFICATION_EMAIL: 'notification.email.queue',
} as const;

export const ROUTING_KEYS = {
  ORDER_PLACED: 'order.placed',
  ORDER_CONFIRMED: 'order.confirmed',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  NOTIFY_ORDER: 'notify.order',
  NOTIFY_PAYMENT: 'notify.payment',
} as const;

export const CACHE_KEYS = {
  PRODUCT: (id: string) => `product:${id}`,
  PRODUCTS_LIST: (page: number, limit: number, category?: string) =>
    `products:list:${page}:${limit}:${category || 'all'}`,
  CART: (userId: string) => `cart:${userId}`,
  TOKEN_BLACKLIST: (token: string) => `blacklist:${token}`,
  REFRESH_TOKEN: (userId: string) => `refresh:${userId}`,
  RATE_LIMIT: (ip: string) => `rate_limit:${ip}`,
  CIRCUIT_BREAKER: (service: string) => `circuit:${service}`,
} as const;

export const CACHE_TTL = {
  PRODUCT: 300,
  PRODUCTS_LIST: 180,
  CART: 86400,
  ACCESS_TOKEN: 900,
  REFRESH_TOKEN: 604800,
} as const;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const SERVICE_PORTS = {
  GATEWAY: 3000,
  AUTH: 3001,
  USER: 3002,
  PRODUCT: 3003,
  CART: 3004,
  ORDER: 3005,
  PAYMENT: 3006,
  NOTIFICATION: 3007,
} as const;

export const SERVICE_URLS = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  USER: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  PRODUCT: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003',
  CART: process.env.CART_SERVICE_URL || 'http://cart-service:3004',
  ORDER: process.env.ORDER_SERVICE_URL || 'http://order-service:3005',
  PAYMENT: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006',
} as const;