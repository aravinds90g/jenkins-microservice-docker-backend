jest.mock('axios');
jest.mock('../cart-service/src/models/Cart');

const axios = require('axios');
const Cart = require('../cart-service/src/models/Cart');
const {
  getCart, addItem, removeItem, updateItemQuantity, clearCart,
} = require('../cart-service/src/controllers/cartController');
const { mockReq, mockRes } = require('./helpers');

const USER_ID = '64b8e6f1c9a4b5d2e3f4a5b6';
const PID = '64b8e6f1c9a4b5d2e3f4a5c0';

function fakeCart(items = []) {
  return {
    userId: USER_ID,
    items,
    toObject() { return { userId: this.userId, items: this.items }; },
    save: jest.fn().mockResolvedValue(this),
  };
}

function mockAxiosProductLookup(products = []) {
  axios.get.mockResolvedValue({ data: { products } });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: make axios.get succeed with no products unless overridden
  mockAxiosProductLookup();
});

describe('cart-service cartController', () => {
  describe('getCart', () => {
    test('returns empty cart shape when no cart exists', async () => {
      Cart.findOne = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await getCart(mockReq({ user: { id: USER_ID } }), res);
      expect(res.json).toHaveBeenCalledWith({
        cart: { userId: USER_ID, items: [], total: 0 },
      });
    });

    test('returns populated cart with computed total', async () => {
      const product = { _id: PID, name: 'Phone', price: 100, image: 'x' };
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 2, selectedVariant: 'red' }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      mockAxiosProductLookup([product]);
      const res = mockRes();
      await getCart(mockReq({ user: { id: USER_ID } }), res);
      const { cart: out } = res.json.mock.calls[0][0];
      expect(out.items[0].product).toEqual(product);
      expect(out.total).toBe(200);
    });

    test('handles product service down by setting product to null', async () => {
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 1 }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      axios.get.mockRejectedValue(new Error('product service down'));
      const res = mockRes();
      await getCart(mockReq({ user: { id: USER_ID } }), res);
      const { cart: out } = res.json.mock.calls[0][0];
      expect(out.items[0].product).toBeNull();
      expect(out.total).toBe(0);
    });
  });

  describe('addItem', () => {
    test('returns 400 if productId missing', async () => {
      const res = mockRes();
      await addItem(mockReq({ user: { id: USER_ID }, body: { quantity: 1 } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('creates new cart and adds first item', async () => {
      Cart.findOne = jest.fn().mockResolvedValue(null);
      const newCart = {
        userId: USER_ID,
        items: [],
        toObject() { return { userId: this.userId, items: this.items }; },
        save: jest.fn().mockResolvedValue(this),
      };
      // Make Cart constructor return our new cart
      Cart.mockImplementation(() => newCart);
      const product = { _id: PID, name: 'Phone', price: 50 };
      mockAxiosProductLookup([product]);
      const res = mockRes();
      await addItem(mockReq({
        user: { id: USER_ID },
        body: { productId: PID, quantity: 1, selectedVariant: 'red' },
      }), res);
      expect(newCart.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
      const { cart } = res.json.mock.calls[0][0];
      expect(cart.items).toHaveLength(1);
      expect(cart.total).toBe(50);
    });

    test('increments quantity for existing same-variant item', async () => {
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 1, selectedVariant: 'red' }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await addItem(mockReq({
        user: { id: USER_ID },
        body: { productId: PID, quantity: 2, selectedVariant: 'red' },
      }), res);
      expect(cart.items[0].quantity).toBe(3);
    });

    test('adds new entry for different variant', async () => {
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 1, selectedVariant: 'red' }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await addItem(mockReq({
        user: { id: USER_ID },
        body: { productId: PID, quantity: 1, selectedVariant: 'blue' },
      }), res);
      expect(cart.items).toHaveLength(2);
      expect(cart.items[1].selectedVariant).toBe('blue');
    });
  });

  describe('removeItem', () => {
    test('returns 404 if no cart', async () => {
      Cart.findOne = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await removeItem(mockReq({ user: { id: USER_ID }, params: { productId: PID } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('removes item matching productId or _id', async () => {
      const cart = fakeCart([
        { _id: 'i1', productId: PID, quantity: 1 },
        { _id: 'i2', productId: 'other', quantity: 1 },
      ]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await removeItem(mockReq({ user: { id: USER_ID }, params: { productId: PID } }), res);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0]._id).toBe('i2');
    });
  });

  describe('updateItemQuantity', () => {
    test('returns 400 if quantity is negative or missing', async () => {
      const res = mockRes();
      await updateItemQuantity(mockReq({
        user: { id: USER_ID }, params: { productId: PID }, body: { quantity: -1 },
      }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('quantity 0 delegates to removeItem', async () => {
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 3 }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await updateItemQuantity(mockReq({
        user: { id: USER_ID }, params: { productId: PID }, body: { quantity: 0 },
      }), res);
      expect(cart.items).toHaveLength(0);
    });

    test('returns 404 if cart not found', async () => {
      Cart.findOne = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await updateItemQuantity(mockReq({
        user: { id: USER_ID }, params: { productId: PID }, body: { quantity: 1 },
      }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns 404 if item not in cart', async () => {
      const cart = fakeCart([]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await updateItemQuantity(mockReq({
        user: { id: USER_ID }, params: { productId: PID }, body: { quantity: 1 },
      }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('updates quantity of matching item', async () => {
      const cart = fakeCart([{ _id: 'i1', productId: PID, quantity: 2 }]);
      Cart.findOne = jest.fn().mockResolvedValue(cart);
      const res = mockRes();
      await updateItemQuantity(mockReq({
        user: { id: USER_ID }, params: { productId: PID }, body: { quantity: 7 },
      }), res);
      expect(cart.items[0].quantity).toBe(7);
    });
  });

  describe('clearCart', () => {
    test('resets items to empty array', async () => {
      Cart.findOneAndUpdate = jest.fn().mockResolvedValue({ items: [] });
      const res = mockRes();
      await clearCart(mockReq({ user: { id: USER_ID } }), res);
      expect(Cart.findOneAndUpdate).toHaveBeenCalledWith(
        { userId: USER_ID }, { items: [] }
      );
      expect(res.json).toHaveBeenCalledWith({
        cart: { userId: USER_ID, items: [], total: 0 },
      });
    });
  });
});
