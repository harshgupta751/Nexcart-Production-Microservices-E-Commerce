import mongoose from 'mongoose';

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://nexcart:nexcart_secret@localhost:27017/product_db?authSource=admin';

const ProductSchema = new mongoose.Schema({
  name: String, description: String, price: Number, comparePrice: Number,
  images: [String], category: String, tags: [String],
  inventory: Number, sku: String, isActive: { type: Boolean, default: true },
  ratings: { average: Number, count: Number },
}, { timestamps: true });

const Product = mongoose.model('Product', ProductSchema);

const SAMPLE_PRODUCTS = [
  { name: 'Wireless Noise-Cancelling Headphones', description: 'Premium wireless headphones with active noise cancellation, 30-hour battery life, and crystal-clear audio quality.', price: 149.99, comparePrice: 199.99, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600'], category: 'Electronics', tags: ['headphones', 'wireless', 'audio'], inventory: 45, sku: 'ELEC-WH-001', ratings: { average: 4.7, count: 234 } },
  { name: 'Mechanical Keyboard TKL', description: 'Tenkeyless mechanical keyboard with Cherry MX switches, RGB backlight, and aluminum frame.', price: 89.99, comparePrice: 119.99, images: ['https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600'], category: 'Electronics', tags: ['keyboard', 'mechanical', 'gaming'], inventory: 30, sku: 'ELEC-KB-002', ratings: { average: 4.8, count: 156 } },
  { name: 'Ergonomic Office Chair', description: 'Fully adjustable ergonomic chair with lumbar support, breathable mesh back, and 4D armrests.', price: 299.99, comparePrice: 399.99, images: ['https://images.unsplash.com/photo-1592078615290-033ee584e267?w=600'], category: 'Home', tags: ['chair', 'ergonomic', 'office'], inventory: 15, sku: 'HOME-CH-001', ratings: { average: 4.5, count: 89 } },
  { name: 'Running Shoes Ultra Boost', description: 'Lightweight running shoes with responsive cushioning and breathable upper.', price: 79.99, comparePrice: 99.99, images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600'], category: 'Sports', tags: ['shoes', 'running', 'fitness'], inventory: 60, sku: 'SPRT-RS-001', ratings: { average: 4.6, count: 312 } },
  { name: 'The Pragmatic Programmer', description: 'A timeless guide to software craftsmanship. Essential reading for every developer.', price: 34.99, images: ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600'], category: 'Books', tags: ['programming', 'software', 'career'], inventory: 100, sku: 'BOOK-PP-001', ratings: { average: 4.9, count: 1024 } },
  { name: 'Smart Watch Series X', description: 'Advanced smartwatch with health monitoring, GPS, 5-day battery, and 50m water resistance.', price: 249.99, comparePrice: 299.99, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600'], category: 'Electronics', tags: ['smartwatch', 'fitness', 'wearable'], inventory: 25, sku: 'ELEC-SW-003', ratings: { average: 4.4, count: 178 } },
  { name: 'Minimalist Leather Backpack', description: 'Premium full-grain leather backpack with 15" laptop compartment and brass hardware.', price: 159.99, images: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600'], category: 'Clothing', tags: ['backpack', 'leather', 'laptop'], inventory: 20, sku: 'CLTH-BP-001', ratings: { average: 4.7, count: 67 } },
  { name: '4K Monitor 27" IPS', description: '27-inch 4K IPS monitor with HDR400, 99% sRGB, and USB-C connectivity.', price: 449.99, comparePrice: 549.99, images: ['https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600'], category: 'Electronics', tags: ['monitor', '4k', 'display'], inventory: 12, sku: 'ELEC-MN-004', ratings: { average: 4.6, count: 203 } },
  { name: 'Premium Yoga Mat', description: '6mm thick non-slip yoga mat from natural tree rubber with carrying strap.', price: 49.99, images: ['https://images.unsplash.com/photo-1601925228003-76a39c55a5f7?w=600'], category: 'Sports', tags: ['yoga', 'fitness', 'mat'], inventory: 80, sku: 'SPRT-YM-002', ratings: { average: 4.8, count: 445 } },
  { name: 'Pour-Over Coffee Kit', description: 'Complete pour-over kit including glass dripper, gooseneck kettle, digital scale, and 50 filters.', price: 69.99, comparePrice: 89.99, images: ['https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600'], category: 'Home', tags: ['coffee', 'pour-over', 'kitchen'], inventory: 35, sku: 'HOME-CF-002', ratings: { average: 4.9, count: 128 } },
];

async function seed() {
  try {
    await mongoose.connect(MONGODB_URL);
    console.log('✓ Connected to MongoDB');
    await Product.deleteMany({});
    console.log('✓ Cleared existing products');
    const created = await Product.insertMany(SAMPLE_PRODUCTS);
    console.log(`✓ Seeded ${created.length} products`);
    created.forEach((p: any) => console.log(`  ${p.name}: ${p._id}`));
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('✓ Done');
  }
}

seed();