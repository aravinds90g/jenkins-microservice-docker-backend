const { Router } = require('express');
const { authenticate, adminOnly } = require('../../../shared/middleware/auth');
const {
  listProducts, getProduct, createProduct,
  updateProduct, deleteProduct, updateStock, restoreStock,
} = require('../controllers/productController');

const router = Router();

router.get('/', listProducts);
router.get('/:id', getProduct);
router.post('/', authenticate, adminOnly, createProduct);
router.put('/:id', authenticate, adminOnly, updateProduct);
router.delete('/:id', authenticate, adminOnly, deleteProduct);
router.patch('/stock', authenticate, updateStock);
router.post('/stock/restore', authenticate, restoreStock);

module.exports = router;
