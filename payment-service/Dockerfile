FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY payment-service/package*.json ./
RUN npm install --omit=dev

COPY payment-service/src ./payment-service/src
COPY payment-service/package.json ./payment-service/
COPY shared ./shared

EXPOSE 3005

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3005/health || exit 1

CMD ["node", "payment-service/src/index.js"]
