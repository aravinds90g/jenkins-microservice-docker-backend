require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

const products = [
  {
    name: 'VOID SOUND PODS XR',
    brand: 'VOID LABS',
    description: 'Cinematic 3D audio, active tactical noise-canceling with raw titanium hardware casing. Engineered for zero acoustic compromises and explosive low-end frequency delivery.',
    price: 18499, oldPrice: 21999, rating: 4.8, reviewsCount: 384,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80',
    category: 'headphones', isHot: true, isSale: true, discount: '15% OFF', stock: 12,
    specs: { 'Driver Unit': '12mm Graphene Coated Duo-Driver', 'ANC Rating': 'Up to 52dB Elite Noise Blocking', 'Battery Life': '42 Hours with Void Charging Pod', 'Connectivity': 'Bluetooth 5.4 Ultra-Latency Mode (12ms)' },
    variants: [{ name: 'Color', options: ['VOID BLACK', 'CYBER AMBER', 'POLAR ICE'] }],
  },
  {
    name: 'NEO PHNX X1 ULTRA',
    brand: 'PHNX GRAPHENE',
    description: 'Fused liquid metal construct, 240Hz dual-layer modular screen, and integrated cooling vents. The ultimate handheld hyper-computer designed for high-stress cellular rendering.',
    price: 99999, oldPrice: 119999, rating: 4.9, reviewsCount: 512,
    image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80',
    category: 'phones', isNew: true, stock: 7,
    specs: { 'Silicon': 'Snapdragon Elite X-3 Streetwear Edition', 'Thermal Control': 'Vapor-Chamber Liquid Nitrogen Cooled', 'Display': '6.9" Graphene OLED, 240Hz Variable Refresh', 'Capture Matrix': '200MP Quad-Sphere Astro Lens' },
    variants: [{ name: 'Storage', options: ['512GB', '1TB EXTREME'] }, { name: 'Color', options: ['MOLTEN RED', 'OBSIDIAN'] }],
  },
  {
    name: 'VOID BOOK PRO M5 MAX',
    brand: 'VOID LABS',
    description: 'Machined monolithic block construction featuring carbon fiber composite underbody, modular graphics bay, and an insane holographic matrix lid display.',
    price: 249999, rating: 5.0, reviewsCount: 128,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&auto=format&fit=crop&q=80',
    category: 'macbook', isHot: true, stock: 4,
    specs: { 'Architecture': '32-Core Infinite Processing Module', 'GPU Module': 'Holographic Voxel Frame Core (128GB VRAM)', 'Underbody': 'Aerospace Carbon Fiber (980g Total Weight)', 'Cooling': 'Twin Electro-Active Sonic Blades' },
    variants: [{ name: 'RAM Boost', options: ['64GB UNIFIED', '128GB ULTRAFLOW'] }],
  },
  {
    name: 'STRIKER APEX THREADRIPPER',
    brand: 'ASUS ROG',
    description: 'Overclocked master-grid circuit system tailored for brutal multi-threaded execution. Explosive heat-sink fins finished with chemical iridescent gold chrome.',
    price: 54999, oldPrice: 65999, rating: 4.7, reviewsCount: 92,
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&auto=format&fit=crop&q=80',
    category: 'motherboards', isSale: true, discount: '₹11000 OFF', stock: 19,
    specs: { 'Socket Array': 'AMD sTR5 Elite Multi-Core Sync', 'RAM Capacity': 'Up to 2TB DDR5 Quad-Channel Stream', 'VRM Phase': '32+3+2 Digital Direct High-Current Phases', 'Thermal Armor': 'Chemical Graphene Vapor-Chamber Armour' },
    variants: [{ name: 'Heat Shield', options: ['GOLD CHROME', 'CARBON MATTE'] }],
  },
  {
    name: 'CHRONOS V16 CINEMA 8K',
    brand: 'SONY ACCORD',
    description: 'Ultra-lightweight modular frame hosting full-aspect anamorphic sensors. Developed in collaboration with industrial streetwear fashion houses for high-fashion runway captures.',
    price: 189999, rating: 4.9, reviewsCount: 76,
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&auto=format&fit=crop&q=80',
    category: 'cameras', isNew: true, stock: 3,
    specs: { 'Sensor Core': 'Full-Frame Cinematic Monolith CMOS II', 'Iso Dynamic Range': '18+ Stops Dual Native Iso (800/3200)', 'Recording Rate': '8K Anamorphic RAW at 120fps Stereo', 'Mount system': 'Titanium Active L-Mount Precision Lock' },
    variants: [{ name: 'Lens Combo', options: ['BODY ONLY', '35MM STREET ANAMORPHIC'] }],
  },
  {
    name: 'ZEPHYR DRIFTER PRO X',
    brand: 'DJI CORE',
    description: 'Tactical stealth flight pattern drone with carbon rotor wings, 4K night-vision sensory sweeps, and extreme high-speed wind slicing capabilities.',
    price: 124999, oldPrice: 139999, rating: 4.8, reviewsCount: 145,
    image: 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=600&auto=format&fit=crop&q=80',
    category: 'drones', isSale: true, discount: '10% OFF', stock: 5,
    specs: { 'Aerospeed max': '112 km/h Advanced Drift Profile', 'Sensor Sphere': 'Omni-Directional Radar Sight Array', 'Battery Module': 'Hydrogen Fluid Cells (55 mins)', 'Stabilization': '6-Axis Graphene Active Suspension' },
    variants: [{ name: 'Propeller Kit', options: ['STEALTH BLACK', 'ELECTRIC ORANGE'] }],
  },
  {
    name: 'VOID GLASS SLATE 12',
    brand: 'VOID LABS',
    description: 'Edge-to-edge transparent micro-LED glass panel that doubles as an active creative surface. Styled with exposed circuitry lines on the perimeter.',
    price: 64999, rating: 4.6, reviewsCount: 211,
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&auto=format&fit=crop&q=80',
    category: 'tablets', isNew: true, stock: 14,
    specs: { 'Glass Core': 'Electrochromic Smart Translucent Nano-Layer', 'Input Interface': '12,000 Pressure level Haptic Pen Array', 'Memory Core': '16GB LPDDR6 High-Velocity Memory', 'Weight Index': 'Featherweight 410g Carbon Blend' },
  },
  {
    name: 'MATRIX SLATE 13 PRO',
    brand: 'PHNX GRAPHENE',
    description: 'Sleek smartphone featuring dual-sided display technology and atomic black ceramic siding. Built to handle brutal high-dynamic cellular gaming workloads.',
    price: 89999, oldPrice: 94999, rating: 4.7, reviewsCount: 312,
    image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=600&auto=format&fit=crop&q=80',
    category: 'phones', stock: 22,
    specs: { 'Chipset': 'Phnx Multi-Voxel G3 Fusion Processor', 'Storage Speed': 'V-NAND Gen 5 Rapid Sector Access', 'Battery Matrix': '6000mAh Dual-Layer Solid State Safe', 'Sensing Array': 'Laser Depth Detection & Thermal Vision' },
    variants: [{ name: 'Storage', options: ['256GB', '512GB'] }],
  },
];

async function connectWithRetry(retries = 15, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
      return;
    } catch (err) {
      console.log(`[seed] mongo not ready, retry ${i}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[seed] could not connect to MongoDB');
}

async function seed() {
  try {
    await connectWithRetry();

    const existing = await Product.countDocuments();
    if (existing > 0) {
      console.log(`[seed] products collection has ${existing} docs, skipping`);
      process.exit(0);
    }

    await Product.insertMany(products);
    console.log(`[seed] inserted ${products.length} products`);
    process.exit(0);
  } catch (err) {
    console.error('[seed] error:', err);
    process.exit(1);
  }
}

seed();
