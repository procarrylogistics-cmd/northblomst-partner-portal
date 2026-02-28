const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema(
  {
    sku: String,
    name: String,
    quantity: Number,
    notes: String
  },
  { _id: false }
);

const AddOnSchema = new mongoose.Schema(
  {
    source: String,
    key: String,
    label: String,
    value: String,
    quantity: Number,
    price: String,
    currency: String,
    lineItemTitle: String,
    sku: String,
    rawKey: String
  },
  { _id: false }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    message: String
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    address1: String,
    address2: String,
    postalCode: String,
    city: String,
    country: String
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    shop: { type: String, index: true },
    orderNumber: { type: String, unique: true, sparse: true },
    receivedAt: { type: Date, default: Date.now },
    shopifyOrderId: { type: String, index: true },
    shopifyOrderNumber: String,
    shopifyOrderName: String,
    orderDate: Date,
    deliveryDate: { type: Date, default: Date.now, index: true },

    products: [ProductSchema],
    addOns: [AddOnSchema],
    addOnsSummary: String,
    customer: CustomerSchema,
    shippingAddress: AddressSchema,

    recipientName: String,
    address: String,
    postcode: String,
    city: String,
    phone: String,
    cardFlag: { type: Boolean, default: false },
    cardText: String,
    notes: String,
    productSummary: String,

    zone: String,
    partner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    assignedAt: { type: Date },
    tags: String,
    totalPrice: { type: mongoose.Schema.Types.Mixed },
    raw: { type: mongoose.Schema.Types.Mixed },

    status: {
      type: String,
      enum: ['new', 'assigned', 'in_production', 'ready', 'fulfilled', 'cancelled'],
      default: 'new',
      index: true
    },

    createdByRole: { type: String, enum: ['admin', 'partner', 'shopify'], default: 'admin' },
    createdByPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByEmail: String,

    updatedAt: Date,
    updatedByRole: String,
    updatedByEmail: String,
    updateCount: { type: Number, default: 0 },
    lastUpdatedFields: [String],

    cancelledAt: Date,
    cancelledByRole: String,
    cancelledByEmail: String,
    cancelReason: String,

    trackingUrl: String,
    trackingNumber: String,

    zapierJobId: String,
    notesInternal: String,
    funeralFlag: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

OrderSchema.index({ shop: 1, shopifyOrderId: 1 }, { unique: true, sparse: true }); // for webhook upsert

module.exports = mongoose.model('Order', OrderSchema);

