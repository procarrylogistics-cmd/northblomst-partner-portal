require('dotenv').config();

const mongoose = require('mongoose');
const Order = require('./src/models/Order');
const User = require('./src/models/User');

async function run() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/northblomst';
  await mongoose.connect(mongoUri);

  console.log('Seeding demo admin, partners and orders...');

  await Order.deleteMany({});
  await User.deleteMany({});

  const admin = await User.create({
    name: 'Northblomst Admin',
    email: 'admin@northblomst.dk',
    passwordHash: await User.hashPassword('admin123'),
    role: 'admin'
  });

  const cphPartner = await User.create({
    name: 'CPH Florist',
    email: 'cph@northblomst.dk',
    passwordHash: await User.hashPassword('partner123'),
    role: 'partner',
    zoneRanges: ['1000-2999'],
    phone: '+4511111111',
    address: 'Nørrebro, 2200 København N'
  });

  const fynPartner = await User.create({
    name: 'Fyn Florist',
    email: 'fyn@northblomst.dk',
    passwordHash: await User.hashPassword('partner123'),
    role: 'partner',
    zoneRanges: ['5000-5999'],
    phone: '+4522222222',
    address: '5000 Odense C'
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const demoOrders = [
    {
      orderNumber: '1000001',
      receivedAt: new Date(),
      shopifyOrderId: 'demo-cph-1',
      shopifyOrderNumber: '1001',
      shopifyOrderName: '#1001',
      orderDate: new Date(),
      deliveryDate: today,
      products: [
        { sku: 'ROSES-12', name: '12 røde roser', quantity: 1, notes: 'Ingen korttekst' }
      ],
      customer: {
        name: 'CPH Kunde',
        phone: '+4533333333',
        email: 'kunde+cph@example.com',
        message: 'Leveres i løbet af dagen'
      },
      shippingAddress: {
        address1: 'Nørrebrogade 123',
        address2: '',
        postalCode: '2200',
        city: 'København N',
        country: 'DK'
      },
      zone: 'CPH',
      partner: cphPartner._id,
      status: 'new'
    },
    {
      orderNumber: '1000002',
      receivedAt: new Date(),
      shopifyOrderId: 'demo-fyn-1',
      shopifyOrderNumber: '1002',
      shopifyOrderName: '#1002',
      orderDate: new Date(),
      deliveryDate: tomorrow,
      products: [
        { sku: 'TULIPS-20', name: '20 tulipaner', quantity: 1, notes: 'Skriv tillykke' }
      ],
      customer: {
        name: 'Fyn Kunde',
        phone: '+4544444444',
        email: 'kunde+fyn@example.com',
        message: 'Leveres formiddag'
      },
      shippingAddress: {
        address1: 'Vestergade 10',
        address2: '',
        postalCode: '5000',
        city: 'Odense C',
        country: 'DK'
      },
      zone: 'Fyn',
      partner: fynPartner._id,
      status: 'in_production'
    },
    {
      orderNumber: '1000003',
      receivedAt: new Date(),
      shopifyOrderId: 'demo-cph-2',
      shopifyOrderNumber: '1003',
      shopifyOrderName: '#1003',
      orderDate: new Date(),
      deliveryDate: yesterday,
      products: [
        { sku: 'MIXED-1', name: 'Blandet buket', quantity: 1, notes: '' }
      ],
      customer: {
        name: 'CPH Kunde 2',
        phone: '+4555555555',
        email: 'kunde2@example.com',
        message: 'Gårsdagens ordre'
      },
      shippingAddress: {
        address1: 'Falkoner Alle 5',
        address2: '',
        postalCode: '2000',
        city: 'Frederiksberg',
        country: 'DK'
      },
      zone: 'CPH',
      partner: cphPartner._id,
      status: 'fulfilled'
    }
  ];

  await Order.insertMany(demoOrders);

  console.log('Seed complete.');
  console.log('Admin login: admin@northblomst.dk / admin123');
  console.log('CPH partner: cph@northblomst.dk / partner123');
  console.log('Fyn partner: fyn@northblomst.dk / partner123');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

