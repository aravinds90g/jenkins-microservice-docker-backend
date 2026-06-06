const Payment = require('../models/Payment');
const { getChannel } = require('../../../shared/rabbitmq');

let _stripe = null;
function getStripe() {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || key.startsWith('sk_test_xxxx')) return null;
  _stripe = require('stripe')(key);
  return _stripe;
}

async function handleOrderCreated(msg) {
  const order = JSON.parse(msg.content.toString());
  console.log('Processing payment for order', order.orderId);

  try {
    const stripe = getStripe();
    let clientSecret;
    let paymentIntentId;
    let mocked = false;

    if (stripe) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(order.amount * 100),
        currency: order.currency || 'inr',
        metadata: { orderId: order.orderId },
      });
      clientSecret = paymentIntent.client_secret;
      paymentIntentId = paymentIntent.id;
    } else {
      paymentIntentId = `pi_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      clientSecret = `${paymentIntentId}_secret_mock`;
      mocked = true;
    }

    await Payment.create({
      orderId: order.orderId,
      paymentIntentId,
      amount: order.amount,
      currency: order.currency || 'inr',
      clientSecret,
      status: 'pending',
    });

    console.log(`Payment ${paymentIntentId} created for order ${order.orderId}${mocked ? ' (mock)' : ''}`);
    getChannel().ack(msg);
  } catch (err) {
    console.error(`Failed to process payment for order ${order.orderId}:`, err.message);
    getChannel().nack(msg, false, true);
  }
}

function startOrderConsumer() {
  const channel = getChannel();
  channel.consume('order-created', handleOrderCreated);
  console.log('Order consumer started');
}

module.exports = { startOrderConsumer };
