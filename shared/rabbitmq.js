const amqp = require('amqplib');

let connection;
let channel;

async function connectRabbitMQ() {
  const url = process.env.RABBITMQ_URL || 'amqp://localhost';
  connection = await amqp.connect(url);
  channel = await connection.createChannel();

  await channel.assertQueue('order-created', { durable: true });
  await channel.assertQueue('payment-completed', { durable: true });

  console.log('RabbitMQ connected');
  return channel;
}

function getChannel() {
  if (!channel) throw new Error('RabbitMQ channel not initialized. Call connectRabbitMQ first.');
  return channel;
}

async function publishEvent(queue, message) {
  const ch = getChannel();
  ch.sendToQueue(queue, Buffer.from(JSON.stringify(message)), { persistent: true });
}

async function closeRabbitMQ() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}

module.exports = { connectRabbitMQ, getChannel, publishEvent, closeRabbitMQ };
