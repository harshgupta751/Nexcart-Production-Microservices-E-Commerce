FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY shared/ ./shared/
COPY services/user-service/package.json ./services/user-service/
COPY services/user-service/tsconfig.json ./services/user-service/
COPY services/user-service/prisma/ ./services/user-service/prisma/
COPY services/user-service/src/ ./services/user-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/shared
RUN npm install && npx tsc -p tsconfig.json
WORKDIR /app/services/user-service
RUN npx prisma generate && npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/user-service/dist ./dist
COPY --from=builder /app/services/user-service/package.json ./
COPY --from=builder /app/services/user-service/prisma ./prisma
COPY --from=builder /app/shared/dist ./node_modules/@nexcart/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@nexcart/shared/package.json
RUN npm install --omit=dev --ignore-scripts && npx prisma generate
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3002/health || exit 1
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]