FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY gateway/package.json ./gateway/
COPY gateway/tsconfig.json ./gateway/
COPY gateway/src/ ./gateway/src/
COPY package.json tsconfig.base.json ./
RUN npm install
WORKDIR /app/shared
RUN npm install && npx tsc -p tsconfig.json
WORKDIR /app/gateway
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/gateway/dist ./dist
COPY --from=builder /app/gateway/package.json ./
COPY --from=builder /app/shared/dist ./node_modules/@nexcart/shared/dist
COPY --from=builder /app/shared/package.json ./node_modules/@nexcart/shared/package.json
RUN npm install --omit=dev --ignore-scripts
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:10000/health || exit 1
CMD ["node", "dist/index.js"]