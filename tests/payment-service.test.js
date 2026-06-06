jest.mock('axios');
jest.mock('../payment-service/src/models/Payment');

const axios = require('axios');
const Payment = require('../payment-service/src/models/Payment');
const {
  createIntent, getStatus, handleWebhook,
} = require('../payment-service/src/controllers/paymentController');
const { mockReq, mockRes } = require('./helpers');

const ORDER_ID = '64b8e6f1c9a4b5d2e3f4a5d0';

beforeEach(() => {
  jest.clearAllMocks();
  // Make sure Stripe is not configured so we hit the mock branch
  delete process.env.STRIPE_SECRET_KEY;
  // Force the module to re-evaluate getStripe by clearing require cache
  jest.resetModules();
});

describe('payment-service paymentController', () => {
  describe('createIntent (mock mode, no Stripe key)', () => {
    let createIntentFresh;
    let PaymentFresh;
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('axios');
      jest.doMock('../payment-service/src/models/Payment');
      PaymentFresh = require('../payment-service/src/models/Payment');
      createIntentFresh = require('../payment-service/src/controllers/paymentController').createIntent;
    });

    test('returns 400 if orderId or amount missing', async () => {
      const res = mockRes();
      await createIntentFresh(mockReq({ body: { orderId: ORDER_ID } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('creates a mock payment intent when Stripe is not configured', async () => {
      PaymentFresh.findOne = jest.fn().mockResolvedValue(null);
      PaymentFresh.create = jest.fn().mockImplementation((doc) => Promise.resolve(doc));
      const res = mockRes();
      await createIntentFresh(mockReq({
        body: { orderId: ORDER_ID, amount: 500, currency: 'INR' },
      }), res);
      expect(res.json).toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.paymentIntentId).toMatch(/^pi_mock_/);
      expect(payload.clientSecret).toMatch(/_secret_mock$/);
      expect(payload.mocked).toBe(true);
      expect(PaymentFresh.create).toHaveBeenCalledWith(expect.objectContaining({
        orderId: ORDER_ID,
        amount: 500,
        currency: 'inr',
        paymentIntentId: expect.stringMatching(/^pi_mock_/),
      }));
    });

    test('returns existing intent on idempotency key match', async () => {
      const existing = {
        clientSecret: 'cs_existing',
        paymentIntentId: 'pi_existing_123',
      };
      PaymentFresh.findOne = jest.fn().mockResolvedValue(existing);
      const res = mockRes();
      await createIntentFresh(mockReq({
        body: { orderId: ORDER_ID, amount: 100, idempotencyKey: 'k1' },
      }), res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        clientSecret: 'cs_existing',
        paymentIntentId: 'pi_existing_123',
        mocked: false,
      }));
      expect(PaymentFresh.create).not.toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    let getStatusFresh;
    let PaymentFresh;
    beforeEach(() => {
      jest.resetModules();
      jest.doMock('axios');
      jest.doMock('../payment-service/src/models/Payment');
      PaymentFresh = require('../payment-service/src/models/Payment');
      getStatusFresh = require('../payment-service/src/controllers/paymentController').getStatus;
    });

    test('returns 404 if no payment for order', async () => {
      const chain = { sort: jest.fn().mockResolvedValue(null) };
      PaymentFresh.findOne = jest.fn().mockReturnValue(chain);
      const res = mockRes();
      await getStatusFresh(mockReq({ params: { orderId: ORDER_ID } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns latest payment for order', async () => {
      const payment = { _id: '1', orderId: ORDER_ID, status: 'succeeded' };
      const chain = { sort: jest.fn().mockResolvedValue(payment) };
      PaymentFresh.findOne = jest.fn().mockReturnValue(chain);
      const res = mockRes();
      await getStatusFresh(mockReq({ params: { orderId: ORDER_ID } }), res);
      expect(res.json).toHaveBeenCalledWith({ payment });
    });
  });

  describe('handleWebhook (Stripe not configured)', () => {
    test('returns 503 if Stripe is not configured on server', async () => {
      jest.resetModules();
      jest.doMock('axios');
      jest.doMock('../payment-service/src/models/Payment');
      const { handleWebhook: handleWebhookFresh } = require('../payment-service/src/controllers/paymentController');
      const res = mockRes();
      await handleWebhookFresh(mockReq({ headers: {}, body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'Stripe is not configured on this server' });
    });
  });
});
