FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY order-service/package*.json ./
RUN npm install --omit=dev

COPY order-service/src ./order-service/src
COPY order-service/package.json ./order-service/
COPY shared ./shared

EXPOSE 3004

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3004/health || exit 1

CMD ["node", "order-service/src/index.js"]
