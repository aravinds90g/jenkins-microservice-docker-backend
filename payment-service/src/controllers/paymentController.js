const Payment = require('../models/Payment');
const axios = require('axios');

const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';

let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_xxxx')) return null;
  _stripe = require('stripe')(key);
  return _stripe;
}

function isStripeConfigured() {
  return !!getStripe();
}

exports.createIntent = async (req, res) => {
  try {
    const { orderId, amount, currency = 'inr', idempotencyKey } = req.body;
    if (!orderId || !amount) {
      return res.status(400).json({ error: 'orderId and amount are required' });
    }

    if (idempotencyKey) {
      const existing = await Payment.findOne({ idempotencyKey });
      if (existing) {
        return res.json({
          clientSecret: existing.clientSecret,
          paymentIntentId: existing.paymentIntentId,
          mocked: existing.paymentIntentId.startsWith('pi_mock_'),
        });
      }
    }

    const stripe = getStripe();
    let clientSecret;
    let paymentIntentId;
    let mocked = false;

    if (stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        metadata: { orderId },
      });
      clientSecret = paymentIntent.client_secret;
      paymentIntentId = paymentIntent.id;
    } else {
      paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      clientSecret = `${paymentIntentId}_secret_mock`;
      mocked = true;
    }

    const payment = await Payment.create({
      orderId,
      paymentIntentId,
      amount,
      currency: currency.toLowerCase(),
      clientSecret,
      status: mocked ? 'pending' : 'pending',
      idempotencyKey,
    });

    res.json({ clientSecret, paymentIntentId, mocked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId }).sort({ createdAt: -1 });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({ error: 'Stripe is not configured on this server' });
  }

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  const paymentIntent = event.data.object;

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        await Payment.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          { status: 'succeeded' }
        );
        const orderId = paymentIntent.metadata.orderId;
        await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, { status: 'paid' }, { timeout: 5000 })
          .catch((e) => console.error('Failed to notify order service:', e.message));
        break;
      }
      case 'payment_intent.payment_failed': {
        await Payment.findOneAndUpdate(
          { paymentIntentId: paymentIntent.id },
          { status: 'failed' }
        );
        const orderId = paymentIntent.metadata.orderId;
        await axios.patch(`${ORDER_SERVICE_URL}/api/orders/${orderId}/status`, { status: 'failed' }, { timeout: 5000 })
          .catch((e) => console.error('Failed to notify order service:', e.message));
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
  }

  res.json({ received: true });
};
