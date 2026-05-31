import { Application, RequestHandler } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { createLogger } from '@nexcart/shared';

const logger = createLogger('API-Gateway:Routes');

const SERVICE_URLS = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://auth-service:3001',
  USER: process.env.USER_SERVICE_URL || 'http://user-service:3002',
  PRODUCT: process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003',
  CART: process.env.CART_SERVICE_URL || 'http://cart-service:3004',
  ORDER: process.env.ORDER_SERVICE_URL || 'http://order-service:3005',
  PAYMENT: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3006',
};

function createProxy(target: string, pathPrefix: string) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => {
      // path prefix wapas add karo jo express ne strip kar di
      return `${pathPrefix}${path}`;
    },
    on: {
      error: (err, req, res: any) => {
        logger.error(`Proxy error to ${target}`, err as Error);
        res.status(503).json({
          success: false,
          message: 'Service temporarily unavailable',
        });
      },
      proxyReq: (proxyReq, req: any) => {
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.userId);
          proxyReq.setHeader('X-User-Email', req.user.email);
          proxyReq.setHeader('X-User-Role', req.user.role);
        }
        proxyReq.setHeader('X-Request-ID', req.requestId || '');
        proxyReq.setHeader('X-Forwarded-By', 'nexcart-gateway');

        if (
          ['POST', 'PUT', 'PATCH'].includes(req.method) &&
          req.body &&
          Object.keys(req.body).length > 0
        ) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
    },
  });
}

export function setupProxyRoutes(
  app: Application,
  authMiddleware: RequestHandler
): void {
  // Auth
  app.use(
    '/api/auth',
    createProxy(SERVICE_URLS.AUTH, '/api/auth')
  );

  // User
  app.use(
    '/api/users',
    authMiddleware,
    createProxy(SERVICE_URLS.USER, '/api/users')
  );

  // Products — GET public
  app.use('/api/products', (req, res, next) => {
    if (req.method === 'GET') return next();
    return authMiddleware(req, res, next);
  });
  app.use(
    '/api/products',
    createProxy(SERVICE_URLS.PRODUCT, '/api/products')
  );

  // Cart
  app.use(
    '/api/cart',
    authMiddleware,
    createProxy(SERVICE_URLS.CART, '/api/cart')
  );

  // Orders
  app.use(
    '/api/orders',
    authMiddleware,
    createProxy(SERVICE_URLS.ORDER, '/api/orders')
  );

  // Payments webhook — no auth
  app.use(
    '/api/payments/webhook',
    createProxy(SERVICE_URLS.PAYMENT, '/api/payments')
  );

  // Payments — auth required
  app.use(
    '/api/payments',
    authMiddleware,
    createProxy(SERVICE_URLS.PAYMENT, '/api/payments')
  );

  logger.info('Proxy routes configured', {
    services: Object.keys(SERVICE_URLS),
  });
}