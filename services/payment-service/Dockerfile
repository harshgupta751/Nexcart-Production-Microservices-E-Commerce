FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY services/payment-service/package.json ./services/payment-service/
COPY services/payment-service/prisma/ ./services/payment-service/prisma/
COPY services/payment-service/src/ ./services/payment-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/services/payment-service
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/payment-service/dist ./dist
COPY --from=builder /app/services/payment-service/package.json ./
COPY --from=builder /app/services/payment-service/prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
EXPOSE 3006
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3006/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]