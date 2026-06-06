FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY product-service/package*.json ./
RUN npm install --omit=dev

COPY product-service/src ./product-service/src
COPY product-service/package.json ./product-service/
COPY shared ./shared

EXPOSE 3002

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3002/health || exit 1

CMD ["sh", "-c", "node product-service/src/seed.js && exec node product-service/src/index.js"]
