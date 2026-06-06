jest.mock('../product-service/src/models/Product');
const Product = require('../product-service/src/models/Product');
const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  updateStock, restoreStock,
} = require('../product-service/src/controllers/productController');
const { mockReq, mockRes } = require('./helpers');

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper to mock Product.find().sort().skip().limit() chain
function mockFindChain(result) {
  const chain = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  };
  Product.find = jest.fn().mockReturnValue(chain);
  Product.countDocuments = jest.fn().mockResolvedValue(result.length);
  return chain;
}

describe('product-service productController', () => {
  describe('listProducts', () => {
    test('returns paginated products with defaults (page=1, limit=20)', async () => {
      const products = [{ _id: '1', name: 'A' }, { _id: '2', name: 'B' }];
      const chain = mockFindChain(products);
      const res = mockRes();
      await listProducts(mockReq({ query: {} }), res);
      expect(Product.find).toHaveBeenCalledWith({});
      expect(chain.sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(chain.skip).toHaveBeenCalledWith(0);
      expect(chain.limit).toHaveBeenCalledWith(20);
      expect(res.json).toHaveBeenCalledWith({
        products, total: 2, page: 1, totalPages: 1,
      });
    });

    test('lowercases category filter', async () => {
      mockFindChain([]);
      await listProducts(mockReq({ query: { category: 'PHONES' } }), res = mockRes());
      expect(Product.find).toHaveBeenCalledWith({ category: 'phones' });
    });

    test('applies price range filter', async () => {
      mockFindChain([]);
      await listProducts(mockReq({ query: { minPrice: '100', maxPrice: '500' } }), res = mockRes());
      expect(Product.find).toHaveBeenCalledWith({ price: { $gte: 100, $lte: 500 } });
    });

    test('applies text search filter', async () => {
      mockFindChain([]);
      await listProducts(mockReq({ query: { search: 'laptop' } }), res = mockRes());
      expect(Product.find).toHaveBeenCalledWith({ $text: { $search: 'laptop' } });
    });

    test('filters by comma-separated ids, dropping invalid ObjectIds', async () => {
      mockFindChain([]);
      await listProducts(mockReq({ query: { ids: '507f1f77bcf86cd799439011,notvalid,507f191e810c19729de860ea' } }), res = mockRes());
      expect(Product.find).toHaveBeenCalledWith({
        _id: { $in: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'] },
      });
    });

    test('applies sort options', async () => {
      for (const [sortArg, expected] of [
        ['price_asc', { price: 1 }],
        ['price_desc', { price: -1 }],
        ['rating', { rating: -1 }],
        ['name', { name: 1 }],
      ]) {
        const chain = mockFindChain([]);
        await listProducts(mockReq({ query: { sort: sortArg } }), res = mockRes());
        expect(chain.sort).toHaveBeenCalledWith(expected);
      }
    });

    test('computes skip correctly for page=2 limit=10', async () => {
      const chain = mockFindChain([]);
      await listProducts(mockReq({ query: { page: '2', limit: '10' } }), res = mockRes());
      expect(chain.skip).toHaveBeenCalledWith(10);
      expect(chain.limit).toHaveBeenCalledWith(10);
    });

    test('handles errors with 500', async () => {
      Product.find = jest.fn(() => { throw new Error('boom'); });
      const res = mockRes();
      await listProducts(mockReq(), res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getProduct', () => {
    test('returns 404 if not found', async () => {
      Product.findById = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await getProduct(mockReq({ params: { id: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns product when found', async () => {
      const product = { _id: '1', name: 'A' };
      Product.findById = jest.fn().mockResolvedValue(product);
      const res = mockRes();
      await getProduct(mockReq({ params: { id: '1' } }), res);
      expect(res.json).toHaveBeenCalledWith({ product });
    });
  });

  describe('createProduct', () => {
    test('creates with status 201', async () => {
      const product = { _id: '1', name: 'A' };
      Product.create = jest.fn().mockResolvedValue(product);
      const res = mockRes();
      await createProduct(mockReq({ body: { name: 'A' } }), res);
      expect(Product.create).toHaveBeenCalledWith({ name: 'A' });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ product });
    });
  });

  describe('updateProduct', () => {
    test('updates with runValidators and returns new doc', async () => {
      const product = { _id: '1', name: 'B' };
      Product.findByIdAndUpdate = jest.fn().mockResolvedValue(product);
      const res = mockRes();
      await updateProduct(mockReq({ params: { id: '1' }, body: { name: 'B' } }), res);
      expect(Product.findByIdAndUpdate).toHaveBeenCalledWith(
        '1', { name: 'B' }, { new: true, runValidators: true }
      );
      expect(res.json).toHaveBeenCalledWith({ product });
    });

    test('returns 404 if not found', async () => {
      Product.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await updateProduct(mockReq({ params: { id: 'x' }, body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('deleteProduct', () => {
    test('deletes and returns message', async () => {
      Product.findByIdAndDelete = jest.fn().mockResolvedValue({ _id: '1' });
      const res = mockRes();
      await deleteProduct(mockReq({ params: { id: '1' } }), res);
      expect(res.json).toHaveBeenCalledWith({ message: 'Product deleted' });
    });
  });

  describe('updateStock', () => {
    test('decrements stock atomically and reports success', async () => {
      Product.bulkWrite = jest.fn().mockResolvedValue({ modifiedCount: 2 });
      const res = mockRes();
      await updateStock(mockReq({
        body: { items: [
          { productId: '1', quantity: 1 },
          { productId: '2', quantity: 3 },
        ] },
      }), res);
      expect(Product.bulkWrite).toHaveBeenCalled();
      const ops = Product.bulkWrite.mock.calls[0][0];
      expect(ops).toHaveLength(2);
      expect(ops[0].updateOne.filter.stock).toEqual({ $gte: 1 });
      expect(ops[0].updateOne.update.$inc.stock).toBe(-1);
      expect(res.json).toHaveBeenCalledWith({ message: 'Stock updated successfully' });
    });

    test('returns 409 when some items have insufficient stock', async () => {
      Product.bulkWrite = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      const res = mockRes();
      await updateStock(mockReq({
        body: { items: [
          { productId: '1', quantity: 1 },
          { productId: '2', quantity: 999 },
        ] },
      }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: '1 item(s) have insufficient stock',
      });
    });
  });

  describe('restoreStock', () => {
    test('returns 400 if items missing or empty', async () => {
      const res = mockRes();
      await restoreStock(mockReq({ body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('increments stock back via bulkWrite', async () => {
      Product.bulkWrite = jest.fn().mockResolvedValue({ modifiedCount: 2 });
      const res = mockRes();
      await restoreStock(mockReq({
        body: { items: [
          { productId: '1', quantity: 1 },
          { productId: '2', quantity: 3 },
        ] },
      }), res);
      const ops = Product.bulkWrite.mock.calls[0][0];
      expect(ops[0].updateOne.update.$inc.stock).toBe(1);
      expect(ops[1].updateOne.update.$inc.stock).toBe(3);
      expect(res.json).toHaveBeenCalledWith({ message: 'Stock restored successfully' });
    });
  });
});
