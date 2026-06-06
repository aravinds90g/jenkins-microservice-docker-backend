// Mock express-http-proxy via the __mocks__ folder at the project root.
// This works regardless of which node_modules directory the gateway resolves
// the module from.
jest.mock('express-http-proxy');

const http = require('http');
const supertest = require('supertest');
const proxyMock = require('express-http-proxy');

function freshApp() {
  jest.resetModules();
  jest.doMock('express-http-proxy');
  return require('../gateway/src/index');
}

function startServer(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('api-gateway', () => {
  describe('GET /health', () => {
    test('returns 200 with service info', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('api-gateway');
        expect(res.body.upstreams).toBeDefined();
        expect(res.body.upstreams.user).toContain('3001');
        expect(res.body.upstreams.product).toContain('3002');
        expect(res.body.upstreams.cart).toContain('3003');
        expect(res.body.upstreams.order).toContain('3004');
        expect(res.body.upstreams.payment).toContain('3005');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });

  describe('public routes (no auth)', () => {
    test('POST /api/users/login proxies to user-service with /api/users prefix', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`).post('/api/users/login');
        expect(res.status).toBe(200);
        expect(res.body.path).toBe('/api/users/login');
        expect(res.body.upstream).toContain('3001');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/users proxies to user-service', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body.path).toMatch(/^\/api\/users\/?$/);
        expect(res.body.upstream).toContain('3001');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/products proxies to product-service', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`).get('/api/products?category=phones');
        expect(res.status).toBe(200);
        expect(res.body.path).toMatch(/^\/api\/products\/?\?category=phones$/);
        expect(res.body.upstream).toContain('3002');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });

  describe('protected routes (require auth)', () => {
    test('GET /api/cart without token returns 401', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`).get('/api/cart');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('No token provided');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/cart with valid token proxies to cart-service', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const token = require('./helpers').userToken();
        const res = await supertest(`http://127.0.0.1:${port}`)
          .get('/api/cart')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.path).toMatch(/^\/api\/cart\/?$/);
        expect(res.body.upstream).toContain('3003');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/orders with valid token proxies to order-service', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const token = require('./helpers').userToken();
        const res = await supertest(`http://127.0.0.1:${port}`)
          .get('/api/orders')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.path).toMatch(/^\/api\/orders\/?$/);
        expect(res.body.upstream).toContain('3004');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/payments/:orderId with valid token proxies to payment-service', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const token = require('./helpers').userToken();
        const res = await supertest(`http://127.0.0.1:${port}`)
          .get('/api/payments/abc123')
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.path).toMatch(/^\/api\/payments\/abc123\/?$/);
        expect(res.body.upstream).toContain('3005');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    test('GET /api/cart with invalid token returns 401', async () => {
      const app = freshApp();
      const { server, port } = await startServer(app);
      try {
        const res = await supertest(`http://127.0.0.1:${port}`)
          .get('/api/cart')
          .set('Authorization', 'Bearer junk');
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid token');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });
});
