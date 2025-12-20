import { Product } from '../types';

export const products: Product[] = [
  {
    id: 1,
    name: 'iPhone 15 Pro Max',
    price: '₦1,950,000',
    rawPrice: 1950000,
    description: 'Titanium design, A17 Pro chip, and the most powerful iPhone camera system ever.',
    image: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
    images: [
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-naturaltitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-whitetitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-blacktitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-bluetitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708'
    ],
    rating: 5,
    category: 'Phones',
    condition: 'New',
    brand: 'Apple',
    colors: ['#8e8e8d', '#f2f1eb', '#2e2e30', '#2f3c4d'], // Natural, White, Black, Blue Titanium
    spec: 'Physical + eSIM'
  },
  {
    id: 2,
    name: 'MacBook Air M2',
    price: '₦1,350,000',
    rawPrice: 1350000,
    description: 'Strikingly thin and fast so you can work, play, or create just about anything, anywhere.',
    image: 'https://pngimg.com/d/macbook_PNG65.png',
    rating: 4.8,
    category: 'Laptops',
    condition: 'New',
    brand: 'Apple',
    colors: ['#2e3034', '#e3e4e5', '#f0e5d3', '#c7c8ca'], // Midnight, Silver, Starlight, Space Gray
    spec: 'M2 Chip'
  },
  {
    id: 3,
    name: 'PS5 Slim Console',
    price: '₦850,000',
    rawPrice: 850000,
    description: 'Experience lightning fast loading with an ultra-high speed SSD and haptic feedback.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/9/90/Sony-PlayStation-5-DualSense-Controller-FL.png',
    rating: 4.9,
    category: 'Gaming',
    condition: 'New',
    brand: 'Sony',
    colors: ['#ffffff', '#000000'],
    spec: '1TB SSD'
  },
  {
    id: 4,
    name: 'Apple Watch Ultra 2',
    price: '₦1,100,000',
    rawPrice: 1100000,
    description: 'The most rugged and capable Apple Watch. Designed for outdoor adventure and endurance.',
    image: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_Watch_Series_5_gold_aluminum_case_with_sport_band.png',
    rating: 5,
    category: 'Accessories',
    condition: 'New',
    brand: 'Apple',
    colors: ['#c6c6c6'], // Titanium
    spec: 'GPS + Cellular'
  },
  {
    id: 5,
    name: 'Used iPhone 12 Pro',
    price: '₦550,000',
    rawPrice: 550000,
    description: 'UK Used, pristine condition with 90% battery health. Comes with generic charger.',
    image: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-12-pro-family-hero?wid=940&hei=1112&fmt=jpeg&qlt=80&.v=1604021663000',
    rating: 4.5,
    category: 'Phones',
    condition: 'Used',
    brand: 'Apple',
    colors: ['#384859', '#fbeccd', '#4d4d4d'], // Pacific Blue, Gold, Graphite
    spec: 'Dual Physical SIM'
  },
  {
    id: 6,
    name: 'HP Pavilion 15',
    price: '₦450,000',
    rawPrice: 450000,
    description: 'Reliable laptop for work and study. Intel Core i5, 16GB RAM, 512GB SSD.',
    image: 'https://ssl-product-images.www8-hp.com/digmedialib/prodimg/lowres/c06950766.png',
    rating: 4.2,
    category: 'Laptops',
    condition: 'Used',
    brand: 'HP',
    colors: ['#c0c0c0', '#2b2b2b'],
    spec: '16GB RAM'
  },
  {
    id: 7,
    name: 'Wireless Gaming Mouse',
    price: '₦45,000',
    rawPrice: 45000,
    description: 'High precision gaming mouse with RGB lighting and programmable buttons.',
    image: 'https://resource.logitechg.com/w_692,c_limit,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/g502-lightspeed/g502-lightspeed-hero.png?v=1',
    rating: 4.7,
    category: 'Accessories',
    condition: 'New',
    brand: 'Logitech',
    colors: ['#000000'],
    spec: '25K DPI'
  },
  {
    id: 8,
    name: 'Canon Pixma Printer',
    price: '₦120,000',
    rawPrice: 120000,
    description: 'All-in-one color inkjet printer, copier, and scanner for home and office use.',
    image: 'https://i1.adis.ws/i/canon/pixma-ts3350-series-black-frt-paper_range?w=500&sm=aspect&aspect=4:3&qlt=80',
    rating: 4.3,
    category: 'Printers',
    condition: 'New',
    brand: 'Canon',
    colors: ['#000000', '#ffffff']
  }
];