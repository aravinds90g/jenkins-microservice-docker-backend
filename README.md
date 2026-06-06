# Void Tech E-Commerce - Backend

Microservices-based e-commerce backend built with **Node.js**, **Express**, **MongoDB**, and **Stripe**.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    User     │     │   Product   │     │    Cart     │     │    Order    │     │   Payment   │
│   Service   │     │   Service   │     │   Service   │     │   Service   │     │   Service   │
│   :3001     │     │   :3002     │     │   :3003     │     │   :3004     │     │   :3005     │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │                   │
       └───────────────────┴───────────────────┴───────────────────┴───────────────────┘
                                           │
                                   ┌───────┴───────┐
                                   │  API Gateway  │
                                   │    :3000      │
                                   └───────┬───────┘
                                           │
                                      Frontend

Each service has its own MongoDB database:
- void-users, void-products, void-carts, void-orders, void-payments
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8080 | Reverse proxy, JWT validation for protected routes |
| User Service | 3001 | Register, login, profile (bcrypt + JWT) |
| Product Service | 3002 | Product CRUD, stock management |
| Cart Service | 3003 | User cart (add/remove/clear items) |
| Order Service | 3004 | Order creation, status lifecycle |
| Payment Service | 3005 | Stripe PaymentIntent, webhook handler |

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB running locally (or Docker)
- Stripe account (for payments)

### 1. Install dependencies

```bash
cd backend
npm install
npm run install:all
```

### 2. Configure environment

Set your Stripe keys in each service's `.env` file (copy from `.env.example`):
- `payment-service/.env` → `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`

All other defaults work out of the box for local development.

### 3. Seed products

```bash
npm --prefix product-service run seed
```

### 4. Start all services

```bash
# Option A: Start individually (6 terminals)
npm run dev:gateway
npm run dev:user
npm run dev:product
npm run dev:cart
npm run dev:order
npm run dev:payment

# Option B: Start all at once
npm run dev
```

### 5. Using Docker

```bash
docker compose up -d
docker compose exec product-service node src/seed.js
```

## API Endpoints

### User Service (`/api/users`)
- `POST /register` — `{ name, email, password }` → `{ token, user }`
- `POST /login` — `{ email, password }` → `{ token, user }`
- `GET /profile` — (auth) → `{ user }`
- `PATCH /profile` — (auth) `{ name?, phone?, address? }` → `{ user }`

### Product Service (`/api/products`)
- `GET /` — List all (supports `?category=&search=&minPrice=&maxPrice=&sort=&page=&limit=`)
- `GET /:id` — Product details
- `POST /` — (admin) Create product
- `PUT /:id` — (admin) Update product
- `DELETE /:id` — (admin) Delete product
- `PATCH /stock` — (admin) Bulk stock update `{ items: [{ productId, quantity }] }`

### Cart Service (`/api/cart`) — all endpoints require auth
- `GET /` — View cart (auto-populates product details from Product Service)
- `POST /items` — Add item `{ productId, quantity, selectedVariant? }`
- `DELETE /items/:productId` — Remove item
- `DELETE /` — Clear cart

### Order Service (`/api/orders`) — all endpoints require auth
- `POST /` — Create order (fetches cart, creates payment intent, clears cart, reduces stock)
- `GET /` — List user orders
- `GET /:id` — Order details
- `PATCH /:id/status` — Update status `{ status }`

### Payment Service (`/api/payments`)
- `POST /create-intent` — (auth) `{ orderId, amount, currency, idempotencyKey? }` → `{ clientSecret, paymentIntentId }`
- `GET /status/:orderId` — (auth) Check payment status
- `POST /webhook/stripe` — Stripe webhook (raw body, signature verified)

## Payment Flow

1. **Frontend → Order Service**: `POST /api/orders` with shipping address
2. **Order Service → Payment Service**: Creates PaymentIntent via Stripe
3. **Order Service → Frontend**: Returns `clientSecret` + order details
4. **Frontend**: Confirms payment with `stripe.confirmCardPayment(clientSecret)`
5. **Stripe → Payment Service (webhook)**: `payment_intent.succeeded`
6. **Payment Service → Order Service**: `PATCH /api/orders/:id/status` → `"paid"`
7. **Frontend**: Polls `GET /api/orders/:id` to see status update

### Testing payment locally

Use Stripe test card: `4242 4242 4242 4242` (any future date, any CVC)

For webhook testing locally, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3005/api/payments/webhook/stripe
stripe trigger payment_intent.succeeded
```

## Idempotency

The payment service supports idempotency keys. Pass `idempotencyKey` in the `create-intent` payload to prevent duplicate charges on retries.
