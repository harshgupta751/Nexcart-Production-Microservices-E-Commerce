FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY services/auth-service/package.json ./services/auth-service/
COPY services/auth-service/tsconfig.json ./services/auth-service/
COPY services/auth-service/prisma/ ./services/auth-service/prisma/
COPY services/auth-service/src/ ./services/auth-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/services/auth-service
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/auth-service/dist ./dist
COPY --from=builder /app/services/auth-service/package.json ./
COPY --from=builder /app/services/auth-service/prisma ./prisma
RUN npm install --omit=dev && npx prisma generate
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3001/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]