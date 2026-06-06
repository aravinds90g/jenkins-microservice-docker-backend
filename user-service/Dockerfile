FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY user-service/package*.json ./
RUN npm install --omit=dev

# Mirror host layout so `require('../../../shared/...')` still resolves
COPY user-service/src ./user-service/src
COPY user-service/package.json ./user-service/
COPY shared ./shared

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/health || exit 1

CMD ["sh", "-c", "node user-service/src/seed.js && exec node user-service/src/index.js"]
