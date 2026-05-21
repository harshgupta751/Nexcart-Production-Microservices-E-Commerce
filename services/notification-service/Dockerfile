FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY services/notification-service/package.json ./services/notification-service/
COPY services/notification-service/tsconfig.json ./services/notification-service/
COPY services/notification-service/src/ ./services/notification-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/services/notification-service
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/services/notification-service/package.json ./
COPY --from=builder /app/shared ./node_modules/@nexcart/shared
RUN npm install --omit=dev --ignore-scripts
EXPOSE 3007
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3007/health || exit 1
CMD ["node", "dist/index.js"]