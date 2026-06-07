const Order = require('../models/Order');
const axios = require('axios');
const { publishEvent } = require('../../../shared/rabbitmq');

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';
const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const CART_SERVICE_URL = process.env.CART_SERVICE_URL || 'http://localhost:3003';

exports.createOrder = async (req, res) => {
  try {
    const { shippingAddress } = req.body;

    const { data: cartData } = await axios.get(`${CART_SERVICE_URL}/api/cart`, {
      headers: { Authorization: req.headers.authorization },
      timeout: 5000,
    });

    const { cart } = cartData;
    if (!cart.items || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Validate that every item has usable product data before building the order.
    // If product service was unreachable when the cart was populated, item.product
    // is null and we would otherwise create an order with price: 0.
    for (const item of cart.items) {
      if (!item.product || typeof item.product.price !== 'number' || item.product.price <= 0 || !item.product.name) {
        return res.status(503).json({
          error: 'Product details are unavailable for one or more items. Please remove the affected item and try again.',
        });
      }
    }

    const items = cart.items.map((item) => ({
      productId: item.productId || item.product._id,
      name: item.product.name,
      image: item.product.image || '',
      price: item.product.price,
      quantity: item.quantity,
      variant: item.selectedVariant,
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await Order.create({
      userId: req.user.id,
      items,
      total,
      shippingAddress: shippingAddress || '',
    });

    publishEvent('order-created', {
      orderId: order._id.toString(),
      userId: order.userId.toString(),
      amount: total,
      currency: 'inr',
      items: items.map((i) => ({ productId: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
    }).catch((e) => console.error('Failed to publish order-created event:', e.message));

    const { data: paymentData } = await axios.post(`${PAYMENT_SERVICE_URL}/api/payments/create-intent`, {
      orderId: order._id.toString(),
      amount: total,
      currency: 'inr',
    }, {
      headers: { Authorization: req.headers.authorization },
      timeout: 10000,
    }).catch((e) => {
      return { data: { paymentIntentId: null, clientSecret: null, error: e.message } };
    });

    if (paymentData.paymentIntentId) {
      order.paymentIntentId = paymentData.paymentIntentId;
      await order.save();
    }

    // Decrement stock BEFORE clearing the cart. If stock is insufficient or the
    // product service is down, we abort and the cart stays intact so the user
    // can retry. Previously, the cart was cleared first, leaving the user with
    // an order and an empty cart on stock failure.
    try {
      await axios.patch(`${PRODUCT_SERVICE_URL}/api/products/stock`, {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }, {
        headers: { Authorization: req.headers.authorization },
        timeout: 5000,
      });
    } catch (stockErr) {
      if (stockErr.response && stockErr.response.status === 409) {
        return res.status(409).json({ error: stockErr.response.data.error || 'Insufficient stock' });
      }
      return res.status(503).json({ error: 'Could not reserve stock. Please try again.' });
    }

    await axios.delete(`${CART_SERVICE_URL}/api/cart`, {
      headers: { Authorization: req.headers.authorization },
      timeout: 5000,
    }).catch((e) => console.error('Failed to clear cart after order:', e.message));

    res.status(201).json({ order, clientSecret: paymentData.clientSecret, mocked: !!paymentData.mocked });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({ error: err.response.data.error || err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrder = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'failed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const previousStatus = order.status;
    order.status = status;

    // If transitioning to cancelled or failed from a state where stock was
    // reserved (pending, paid) and we haven't already restored it, put the
    // stock back. Shipped/delivered orders are skipped — stock is committed.
    const shouldRestoreStock =
      (status === 'cancelled' || status === 'failed') &&
      !order.stockRestored &&
      (previousStatus === 'pending' || previousStatus === 'paid');

    if (shouldRestoreStock) {
      try {
        await axios.post(`${PRODUCT_SERVICE_URL}/api/products/stock/restore`, {
          items: order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }, { timeout: 5000 });
        order.stockRestored = true;
      } catch (restoreErr) {
        console.error('Failed to restore stock for order', order._id, restoreErr.message);
        return res.status(503).json({ error: 'Could not restore stock. Status not changed.' });
      }
    }

    await order.save();
    res.json({ order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
