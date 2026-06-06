const Cart = require('../models/Cart');
const axios = require('axios');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';

function toPlainCart(mongooseCart) {
  if (!mongooseCart) return { items: [] };
  const obj = typeof mongooseCart.toObject === 'function' ? mongooseCart.toObject() : mongooseCart;
  return obj;
}

exports.getCart = async (req, res) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      return res.json({ cart: { userId: req.user.id, items: [], total: 0 } });
    }
    const plain = toPlainCart(cart);
    await populateProducts(plain);
    const total = plain.items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    res.json({ cart: { ...plain, total } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { productId, quantity = 1, selectedVariant } = req.body;
    if (!productId) return res.status(400).json({ error: 'productId is required' });

    let cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) {
      cart = new Cart({ userId: req.user.id, items: [] });
    }

    const existing = cart.items.find(
      (i) => i.productId.toString() === productId && i.selectedVariant === (selectedVariant || undefined)
    );
    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({ productId, quantity, selectedVariant });
    }

    await cart.save();
    const plain = toPlainCart(cart);
    await populateProducts(plain);
    const total = plain.items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    res.json({ cart: { ...plain, total } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter((i) => i._id.toString() !== productId && i.productId.toString() !== productId);
    await cart.save();
    const plain = toPlainCart(cart);
    await populateProducts(plain);
    const total = plain.items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    res.json({ cart: { ...plain, total } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateItemQuantity = async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({ error: 'quantity is required and must be >= 0' });
    }
    if (quantity === 0) {
      return exports.removeItem(req, res);
    }
    const cart = await Cart.findOne({ userId: req.user.id });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(
      (i) => i.productId.toString() === productId || i._id.toString() === productId
    );
    if (!item) return res.status(404).json({ error: 'Item not found in cart' });

    item.quantity = quantity;
    await cart.save();
    const plain = toPlainCart(cart);
    await populateProducts(plain);
    const total = plain.items.reduce((sum, item) => sum + (item.product?.price || 0) * item.quantity, 0);
    res.json({ cart: { ...plain, total } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    await Cart.findOneAndUpdate({ userId: req.user.id }, { items: [] });
    res.json({ cart: { userId: req.user.id, items: [], total: 0 } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

async function populateProducts(plainCart) {
  if (!plainCart.items || !plainCart.items.length) return;
  const ids = [...new Set(plainCart.items.map((i) => i.productId.toString()))];
  let productMap = {};
  try {
    const { data } = await axios.get(`${PRODUCT_SERVICE_URL}/api/products`, {
      params: { ids: ids.join(','), limit: 100 },
      timeout: 5000,
    });
    const products = data.products || [];
    for (const p of products) productMap[p._id] = p;
  } catch {
    productMap = {};
  }
  for (const item of plainCart.items) {
    item.product = productMap[item.productId.toString()] || null;
  }
}
