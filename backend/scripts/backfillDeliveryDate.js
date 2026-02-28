#!/usr/bin/env node
/**
 * Backfill deliveryDate for orders in MongoDB.
 * Extracts from raw.note_attributes, raw.line_items, raw.estimated_delivery_at.
 * Run: node scripts/backfillDeliveryDate.js
 * Or: npm run backfill-delivery-date (add script to package.json)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Order = require('../src/models/Order');
const { extractDeliveryFromOrderDoc } = require('../src/utils/deliveryDateExtractor');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/northblomst');
  const orders = await Order.find({});
  let updated = 0;
  for (const order of orders) {
    const { deliveryDate, deliveryOption } = extractDeliveryFromOrderDoc(order);
    if (!deliveryDate) continue;
    const oldVal = order.deliveryDate ? order.deliveryDate.getTime() : null;
    const newVal = deliveryDate.getTime();
    if (oldVal !== newVal) {
      order.deliveryDate = deliveryDate;
      if (deliveryOption) order.deliveryOption = deliveryOption;
      await order.save();
      updated++;
      console.log('Updated', order.shopifyOrderName || order._id, '->', deliveryDate.toISOString().slice(0, 10));
    }
  }
  console.log('Done. Total:', orders.length, 'Updated:', updated);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
