FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache wget

COPY gateway/package*.json ./
RUN npm install --omit=dev

# Gateway does not import from shared/, so plain copy is fine
COPY gateway/src ./src

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

CMD ["node", "src/index.js"]
