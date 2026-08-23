export const BRAND = {
  name: 'Mangwaoo.com',
  tagline: 'Time Bachao, Mangwaoo Chalao!',
  description: 'Karachi\'s Trusted Delivery Service',
  phone: '+92 315 0699930',
  hours: '12:00 PM to 1:00 AM',
  email: 'hello@mangwaoo.com',
};

export const SERVICES = [
  {
    id: 1,
    name: 'Fast Food Delivery',
    description: 'Order your favorite meals from top restaurants with lightning-fast delivery.',
    icon: 'UtensilsCrossed',
    color: 'from-red-500 to-red-600',
    details: 'Get your favorite fast food delivered hot and fresh to your doorstep within 30 minutes.',
  },
  {
    id: 2,
    name: 'Grocery Delivery',
    description: 'Fresh groceries delivered to your home within hours.',
    icon: 'ShoppingCart',
    color: 'from-yellow-500 to-orange-500',
    details: 'Shop from local supermarkets and get fresh groceries delivered same day.',
  },
  {
    id: 3,
    name: 'Dairy Items Delivery',
    description: 'Fresh milk, yogurt, and dairy products at your doorstep.',
    icon: 'Milk',
    color: 'from-blue-400 to-blue-500',
    details: 'Get fresh dairy products from trusted suppliers delivered daily or on-demand.',
  },
  {
    id: 4,
    name: 'Medicine Delivery',
    description: 'Quick and reliable medicine delivery from verified pharmacies.',
    icon: 'Pill',
    color: 'from-green-500 to-green-600',
    details: 'Order medicines online and get them delivered within hours with verified authenticity.',
  },
];

export const SERVICE_AREAS = [
  {
    id: 1,
    name: 'Gulshan e Iqbal',
    description: 'Premium delivery service available',
    status: 'active',
    coordinates: { lat: 24.92, lng: 67.0947 },
    deliveryRadiusKm: 3,
  },
  {
    id: 2,
    name: 'North Nazimabad',
    description: 'Express delivery service',
    status: 'active',
    coordinates: { lat: 24.9342, lng: 67.0447 },
    deliveryRadiusKm: 2.5,
  },
  {
    id: 3,
    name: 'North Karachi',
    description: 'Fully covered with 24/7 delivery service',
    status: 'active',
    coordinates: { lat: 24.9875, lng: 67.0643 },
    deliveryRadiusKm: 3,
  },
  {
    id: 4,
    name: 'Disco More',
    description: 'Quick delivery available',
    status: 'active',
    coordinates: { lat: 24.9806, lng: 67.0574 },
    deliveryRadiusKm: 2,
  },
  {
    id: 5,
    name: 'New Karachi',
    description: 'Standard delivery service',
    status: 'active',
    coordinates: { lat: 24.9989, lng: 67.0563 },
    deliveryRadiusKm: 2.5,
  },
];

export const WHY_CHOOSE_US = [
  {
    id: 1,
    title: 'Lightning Fast',
    description: 'Get your orders within 30 minutes',
    icon: 'Zap',
  },
  {
    id: 2,
    title: 'Trusted & Reliable',
    description: 'Verified delivery partners with excellent track record',
    icon: 'CheckCircle',
  },
  {
    id: 3,
    title: 'Extended Hours',
    description: 'Order anytime from 12 PM to 1 AM, 7 days a week',
    icon: 'Clock',
  },
  {
    id: 4,
    title: 'Multiple Categories',
    description: 'Food, groceries, dairy, and medicines all in one app',
    icon: 'Package',
  },
  {
    id: 5,
    title: 'Easy Ordering',
    description: 'Simple ordering through MangwaooMart and Food',
    icon: 'Smartphone',
  },
  {
    id: 6,
    title: 'Fair Pricing',
    description: 'No hidden charges, transparent pricing always',
    icon: 'DollarSign',
  },
];

export const TESTIMONIALS = [
  {
    id: 1,
    name: 'Ahmed Khan',
    role: 'Regular Customer',
    content: 'Mangwaoo delivered my order in just 35 minutes! The food was hot and fresh. Highly recommended!',
    rating: 5,
    avatar: '👤',
  },
  {
    id: 2,
    name: 'Fatima Ali',
    role: 'Busy Professional',
    content: 'Love how convenient it is to order groceries while at work. Delivery is always on time.',
    rating: 5,
    avatar: '👩',
  },
  {
    id: 3,
    name: 'Muhammad Hassan',
    role: 'Student',
    content: 'Cheapest delivery service in Karachi with great quality. Perfect for students like me!',
    rating: 5,
    avatar: '👨',
  },
  {
    id: 4,
    name: 'Zara Sheikh',
    role: 'Homemaker',
    content: 'The medicine delivery service was lifesaving. Got my prescription delivered within an hour.',
    rating: 5,
    avatar: '👩‍🦰',
  },
];

export const FUTURE_ROADMAP = [
  {
    phase: 'Phase 1',
    title: 'Multi-Vendor Integration',
    description: 'Launch vendor dashboard allowing restaurants and shops to manage orders',
    features: ['Vendor Dashboard', 'Order Management', 'Real-time Analytics'],
  },
  {
    phase: 'Phase 2',
    title: 'Customer Ecosystem',
    description: 'Mobile apps, customer accounts, and wallet integration',
    features: ['Android App', 'iOS App', 'User Accounts', 'Digital Wallet'],
  },
  {
    phase: 'Phase 3',
    title: 'Advanced Features',
    description: 'Real-time tracking, ratings, reviews, and promotional system',
    features: ['Live Tracking', 'Ratings & Reviews', 'Coupons', 'Loyalty Program'],
  },
  {
    phase: 'Phase 4',
    title: 'Full Marketplace',
    description: 'Complete eCommerce platform with subscription plans and payments',
    features: ['Subscription Plans', 'Online Payments', 'Seller Hub', 'Analytics Dashboard'],
  },
];

export const MART_CATEGORIES = [
  {
    id: 1,
    name: 'Fruits & Vegetables',
    description: 'Farm-fresh produce sourced daily from local markets.',
    icon: '🥦',
  },
  {
    id: 2,
    name: 'Dairy & Eggs',
    description: 'Milk, yogurt, cheese, and farm-fresh eggs.',
    icon: '🥚',
  },
  {
    id: 3,
    name: 'Snacks & Beverages',
    description: 'Chips, biscuits, soft drinks, and juices.',
    icon: '🥤',
  },
  {
    id: 4,
    name: 'Household Essentials',
    description: 'Cleaning supplies, detergents, and daily-use items.',
    icon: '🧺',
  },
  {
    id: 5,
    name: 'Personal Care',
    description: 'Toiletries, skincare, and hygiene products.',
    icon: '🧴',
  },
  {
    id: 6,
    name: 'Meat & Seafood',
    description: 'Fresh and frozen meat, chicken, and fish.',
    icon: '🍗',
  },
  {
    id: 7,
    name: 'Men',
    description: 'Clothing, footwear, and accessories for men.',
    icon: '👔',
  },
  {
    id: 8,
    name: 'Women',
    description: 'Clothing, footwear, and accessories for women.',
    icon: '👗',
  },
  {
    id: 9,
    name: 'Kids',
    description: 'Clothing, toys, and essentials for kids.',
    icon: '🧒',
  },
];

export const GULPLAZA_CATEGORIES = [
  {
    id: 1,
    name: 'Restaurants & Cloud Kitchens',
    description: 'Full meals and daily specials from local restaurants.',
    icon: '🍽️',
  },
  {
    id: 2,
    name: 'Bakery & Desserts',
    description: 'Cakes, pastries, and sweet treats baked fresh.',
    icon: '🍰',
  },
  {
    id: 3,
    name: 'Beverages',
    description: 'Juices, shakes, tea, and coffee from local vendors.',
    icon: '🥤',
  },
  {
    id: 4,
    name: 'Fast Food',
    description: 'Burgers, fries, and quick bites delivered hot.',
    icon: '🍔',
  },
  {
    id: 5,
    name: 'Home-Cooked & Tiffin',
    description: 'Daily home-style meals and tiffin services.',
    icon: '🍱',
  },
  {
    id: 6,
    name: 'Catering & Bulk Orders',
    description: 'Bulk food orders for events and gatherings.',
    icon: '🍛',
  },
];

export const PROFESSIONAL_SERVICES = [
  {
    id: 1,
    name: 'Web Development',
    slug: 'web-development',
    icon: '💻',
    description: 'Custom websites and web apps built and maintained for your business.',
  },
  {
    id: 2,
    name: 'Graphics Designing',
    slug: 'graphics-designing',
    icon: '🎨',
    description: 'Logos, branding kits, and social media creatives that stand out.',
  },
  {
    id: 3,
    name: 'Video Editing',
    slug: 'video-editing',
    icon: '🎬',
    description: 'Reels, ads, and event videos edited fast and professionally.',
  },
  {
    id: 4,
    name: 'Bike Mechanic',
    slug: 'bike-mechanic',
    icon: '🏍️',
    description: 'On-demand bike repair, servicing, and tuning at your doorstep.',
  },
  {
    id: 5,
    name: 'Car Mechanic',
    slug: 'car-mechanic',
    icon: '🚗',
    description: 'Doorstep car diagnostics, repair, and routine servicing.',
  },
  {
    id: 6,
    name: 'Plumber',
    slug: 'plumber',
    icon: '🚿',
    description: 'Leak repairs, pipe fitting, and bathroom or kitchen plumbing.',
  },
  {
    id: 7,
    name: 'Electrician',
    slug: 'electrician',
    icon: '💡',
    description: 'Wiring, appliance installation, and electrical repairs done safely.',
  },
  {
    id: 8,
    name: 'Interior Designer',
    slug: 'interior-designer',
    icon: '🛋️',
    description: 'Home and office interior design consultation and execution.',
  },
];

export const MART_ADS = [
  {
    id: 1,
    title: 'Fast delivery, every time',
    description: 'Get your orders within 30 minutes across active Karachi areas.',
    image: '/delivery-bike-hero.png',
    ctaLabel: 'Start Shopping',
    href: '/mart',
    external: false,
  },
  {
    id: 2,
    title: 'Sell on MangwaooMart',
    description: 'List your shop and reach thousands of customers across Karachi.',
    image: '/home-banner.png',
    ctaLabel: 'Become a Vendor',
    href: '/sell',
    external: false,
  },
];

export const GULPLAZA_ADS = [
  {
    id: 1,
    title: 'List on Food',
    description: 'Approved food business owners reach buyers across Karachi.',
    image: '/home-banner.png',
    ctaLabel: 'Apply to Sell',
    href: '/sell',
    external: false,
  },
  {
    id: 2,
    title: 'Bulk order inquiries',
    description: 'Talk to us directly for catering and bulk food orders.',
    image: '/delivery-bike-hero.png',
    ctaLabel: 'Contact Us',
    href: '/contact',
    external: false,
  },
];

export const MART_PRODUCTS = [
  {
    id: 1,
    name: 'Fresh Tomatoes (1 kg)',
    category: 'Fruits & Vegetables',
    vendor: 'Karachi Fresh Mart',
    price: 'PKR 120',
    icon: '🍅',
  },
  {
    id: 2,
    name: 'Full Cream Milk (1.5 L)',
    category: 'Dairy & Eggs',
    vendor: 'North Karachi Dairy',
    price: 'PKR 350',
    icon: '🥛',
  },
  {
    id: 3,
    name: 'Farm Eggs (Dozen)',
    category: 'Dairy & Eggs',
    vendor: 'North Karachi Dairy',
    price: 'PKR 380',
    icon: '🥚',
  },
  {
    id: 4,
    name: 'Basmati Rice (5 kg)',
    category: 'Household Essentials',
    vendor: 'Bufferzone General Store',
    price: 'PKR 1,450',
    icon: '🍚',
  },
  {
    id: 5,
    name: 'Cooking Oil (1 L)',
    category: 'Household Essentials',
    vendor: 'Bufferzone General Store',
    price: 'PKR 620',
    icon: '🛢️',
  },
  {
    id: 6,
    name: 'Chicken Breast (1 kg)',
    category: 'Meat & Seafood',
    vendor: 'Disco Mor Poultry',
    price: 'PKR 580',
    icon: '🍗',
  },
  {
    id: 7,
    name: 'Assorted Juice Pack',
    category: 'Snacks & Beverages',
    vendor: 'UP Mor Superstore',
    price: 'PKR 450',
    icon: '🧃',
  },
  {
    id: 8,
    name: 'Dish Wash Liquid (500 ml)',
    category: 'Personal Care',
    vendor: 'Nagan Chowrangi Mart',
    price: 'PKR 240',
    icon: '🧴',
  },
];

export const STATS = [
  { label: 'Active Areas', value: '5', icon: 'MapPin' },
  { label: 'Service Categories', value: '4', icon: 'Grid' },
  { label: 'Operating Hours', value: '13h', icon: 'Clock' },
  { label: 'Avg Delivery Time', value: '45 min', icon: 'Zap' },
];
