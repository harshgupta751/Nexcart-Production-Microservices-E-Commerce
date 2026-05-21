FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY services/cart-service/package.json ./services/cart-service/
COPY services/cart-service/tsconfig.json ./services/cart-service/
COPY services/cart-service/src/ ./services/cart-service/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/services/cart-service
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/services/cart-service/dist ./dist
COPY --from=builder /app/services/cart-service/package.json ./
COPY --from=builder /app/shared ./node_modules/@nexcart/shared
RUN npm install --omit=dev --ignore-scripts
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3004/health || exit 1
CMD ["node", "dist/index.js"]