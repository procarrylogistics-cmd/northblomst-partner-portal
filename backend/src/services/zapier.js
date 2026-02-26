const axios = require('axios');

async function triggerZapierForOrder(order, partner) {
  const webhookUrl = process.env.ZAPIER_TRACKPOD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('ZAPIER_TRACKPOD_WEBHOOK_URL not set, skipping Zapier trigger');
    return;
  }

  const payload = {
    orderId: order._id.toString(),
    shopifyOrderId: order.shopifyOrderId,
    orderNumber: order.shopifyOrderNumber || order.shopifyOrderName,
    customer: order.customer,
    shippingAddress: order.shippingAddress,
    products: order.products,
    partner: {
      id: partner._id.toString(),
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      address: partner.address
    }
  };

  await axios.post(webhookUrl, payload);
}

module.exports = {
  triggerZapierForOrder
};

