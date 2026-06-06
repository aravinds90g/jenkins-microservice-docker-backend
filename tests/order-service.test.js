jest.mock('axios');
jest.mock('../order-service/src/models/Order');

const axios = require('axios');
const Order = require('../order-service/src/models/Order');
const {
  createOrder, listOrders, getOrder, updateStatus, getAllOrders,
} = require('../order-service/src/controllers/orderController');
const { mockReq, mockRes } = require('./helpers');

const USER_ID = '64b8e6f1c9a4b5d2e3f4a5b6';
const PID = '64b8e6f1c9a4b5d2e3f4a5c0';
const ORDER_ID = '64b8e6f1c9a4b5d2e3f4a5d0';

function populatedCart() {
  return {
    userId: USER_ID,
    items: [{
      productId: PID,
      quantity: 2,
      selectedVariant: 'red',
      product: { _id: PID, name: 'Phone', price: 100, image: 'img' },
    }],
    total: 200,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('order-service orderController', () => {
  describe('createOrder', () => {
    test('returns 400 if cart is empty', async () => {
      axios.get.mockResolvedValue({ data: { cart: { userId: USER_ID, items: [], total: 0 } } });
      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' }, body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cart is empty' });
    });

    test('returns 503 if any item is missing product details', async () => {
      const bad = { userId: USER_ID, items: [{ productId: PID, quantity: 1, product: null }], total: 0 };
      axios.get.mockResolvedValue({ data: { cart: bad } });
      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' } }), res);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    test('returns 503 if product has price <= 0', async () => {
      const bad = { userId: USER_ID, items: [{ productId: PID, quantity: 1, product: { _id: PID, name: 'X', price: 0 } }], total: 0 };
      axios.get.mockResolvedValue({ data: { cart: bad } });
      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' } }), res);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    test('happy path: creates order, calls payment, decrements stock, clears cart', async () => {
      axios.get.mockResolvedValue({ data: { cart: populatedCart() } });
      axios.post.mockResolvedValue({
        data: { paymentIntentId: 'pi_123', clientSecret: 'cs_123', mocked: true },
      });
      axios.patch.mockResolvedValue({ data: { message: 'ok' } });
      axios.delete.mockResolvedValue({ data: {} });
      Order.create = jest.fn().mockResolvedValue({
        _id: ORDER_ID, userId: USER_ID, items: [], total: 200, save: jest.fn().mockResolvedValue(this),
      });

      const res = mockRes();
      await createOrder(mockReq({
        user: { id: USER_ID },
        headers: { authorization: 'Bearer x' },
        body: { shippingAddress: 'addr' },
      }), res);

      // 1. fetch cart from cart-service
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/cart'),
        expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer x' }) })
      );
      // 2. create payment intent
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/payments/create-intent'),
        expect.objectContaining({ orderId: ORDER_ID, amount: 200, currency: 'inr' }),
        expect.any(Object)
      );
      // 3. decrement stock
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/stock'),
        expect.objectContaining({ items: [{ productId: PID, quantity: 2 }] }),
        expect.any(Object)
      );
      // 4. clear cart
      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringContaining('/api/cart'),
        expect.any(Object)
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('returns 409 on insufficient stock', async () => {
      axios.get.mockResolvedValue({ data: { cart: populatedCart() } });
      axios.post.mockResolvedValue({ data: { paymentIntentId: 'pi_1', clientSecret: 'cs_1', mocked: true } });
      const err = new Error('Conflict');
      err.response = { status: 409, data: { error: 'Insufficient stock' } };
      axios.patch.mockRejectedValue(err);

      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Insufficient stock' });
    });

    test('returns 503 on other stock errors', async () => {
      axios.get.mockResolvedValue({ data: { cart: populatedCart() } });
      axios.post.mockResolvedValue({ data: { paymentIntentId: 'pi_1', clientSecret: 'cs_1', mocked: true } });
      axios.patch.mockRejectedValue(new Error('product service down'));

      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' } }), res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({ error: 'Could not reserve stock. Please try again.' });
    });

    test('proceeds even if payment intent fails (mocked=true with no intent)', async () => {
      axios.get.mockResolvedValue({ data: { cart: populatedCart() } });
      axios.post.mockRejectedValue(new Error('payment service down'));
      axios.patch.mockResolvedValue({ data: {} });
      axios.delete.mockResolvedValue({ data: {} });
      Order.create = jest.fn().mockResolvedValue({
        _id: ORDER_ID, userId: USER_ID, items: [], total: 200, save: jest.fn().mockResolvedValue(this),
      });

      const res = mockRes();
      await createOrder(mockReq({ user: { id: USER_ID }, headers: { authorization: 'Bearer x' } }), res);
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.mocked).toBe(false);
      expect(payload.clientSecret).toBeNull();
    });
  });

  describe('listOrders', () => {
    test('returns user orders sorted desc', async () => {
      const orders = [{ _id: '1' }];
      Order.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(orders) });
      const res = mockRes();
      await listOrders(mockReq({ user: { id: USER_ID } }), res);
      expect(Order.find).toHaveBeenCalledWith({ userId: USER_ID });
      expect(res.json).toHaveBeenCalledWith({ orders });
    });
  });

  describe('getOrder', () => {
    test('returns 404 if not owned / not found', async () => {
      Order.findOne = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await getOrder(mockReq({ user: { id: USER_ID }, params: { id: ORDER_ID } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('scopes query to userId', async () => {
      Order.findOne = jest.fn().mockResolvedValue({ _id: ORDER_ID });
      const res = mockRes();
      await getOrder(mockReq({ user: { id: USER_ID }, params: { id: ORDER_ID } }), res);
      expect(Order.findOne).toHaveBeenCalledWith({ _id: ORDER_ID, userId: USER_ID });
    });
  });

  describe('updateStatus', () => {
    test('rejects invalid status with 400', async () => {
      const res = mockRes();
      await updateStatus(mockReq({ params: { id: ORDER_ID }, body: { status: 'nope' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('updates status to paid without touching stock', async () => {
      const order = {
        _id: ORDER_ID, status: 'pending', stockRestored: false,
        items: [{ productId: PID, quantity: 1 }],
        save: jest.fn().mockResolvedValue(this),
      };
      Order.findById = jest.fn().mockResolvedValue(order);
      const res = mockRes();
      await updateStatus(mockReq({ params: { id: ORDER_ID }, body: { status: 'paid' } }), res);
      expect(order.status).toBe('paid');
      expect(order.save).toHaveBeenCalled();
      expect(axios.post).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ order });
    });

    test('cancel from pending restores stock and sets stockRestored', async () => {
      const order = {
        _id: ORDER_ID, status: 'pending', stockRestored: false,
        items: [{ productId: PID, quantity: 3 }],
        save: jest.fn().mockResolvedValue(this),
      };
      Order.findById = jest.fn().mockResolvedValue(order);
      axios.post.mockResolvedValue({ data: { message: 'ok' } });
      const res = mockRes();
      await updateStatus(mockReq({ params: { id: ORDER_ID }, body: { status: 'cancelled' } }), res);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/products/stock/restore'),
        expect.objectContaining({ items: [{ productId: PID, quantity: 3 }] }),
        expect.any(Object)
      );
      expect(order.stockRestored).toBe(true);
      expect(order.status).toBe('cancelled');
    });

    test('does NOT restore stock for already-restored cancelled order', async () => {
      const order = {
        _id: ORDER_ID, status: 'pending', stockRestored: true,
        items: [{ productId: PID, quantity: 1 }],
        save: jest.fn().mockResolvedValue(this),
      };
      Order.findById = jest.fn().mockResolvedValue(order);
      const res = mockRes();
      await updateStatus(mockReq({ params: { id: ORDER_ID }, body: { status: 'cancelled' } }), res);
      expect(axios.post).not.toHaveBeenCalled();
    });

    test('does NOT restore stock for shipped orders', async () => {
      const order = {
        _id: ORDER_ID, status: 'shipped', stockRestored: false,
        items: [{ productId: PID, quantity: 1 }],
        save: jest.fn().mockResolvedValue(this),
      };
      Order.findById = jest.fn().mockResolvedValue(order);
      const res = mockRes();
      await updateStatus(mockReq({ params: { id: ORDER_ID }, body: { status: 'cancelled' } }), res);
      expect(axios.post).not.toHaveBeenCalled();
    });
  });

  describe('getAllOrders (admin)', () => {
    test('returns all orders sorted desc', async () => {
      const orders = [{ _id: '1' }, { _id: '2' }];
      Order.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(orders) });
      const res = mockRes();
      await getAllOrders(mockReq(), res);
      expect(Order.find).toHaveBeenCalledWith();
      expect(res.json).toHaveBeenCalledWith({ orders });
    });
  });
});
