FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY cart-service/package*.json ./
RUN npm install --omit=dev

COPY cart-service/src ./cart-service/src
COPY cart-service/package.json ./cart-service/
COPY shared ./shared

EXPOSE 3003

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3003/health || exit 1

CMD ["node", "cart-service/src/index.js"]
