FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY services/order-service/package.json ./services/order-service/
COPY services/order-service/prisma/ ./services/order-service/prisma/
COPY services/order-service/src/ ./services/order-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/services/order-service
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/order-service/dist ./dist
COPY --from=builder /app/services/order-service/package.json ./
COPY --from=builder /app/services/order-service/prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3005/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]