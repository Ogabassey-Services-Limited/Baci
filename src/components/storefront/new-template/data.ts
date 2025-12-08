import type { Product } from './types';

export const products: Product[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    price: '₦1,950,000',
    rawPrice: 1950000,
    originalPrice: '₦2,100,000',
    image:
      'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&q=80&w=800',
    category: 'Phones',
    rating: 4.8,
    reviews: 124,
    inStock: true,
    isNew: true,
    specs: {
      screen: '6.7"',
      storage: '256GB',
      color: 'Natural Titanium',
    },
  },
  {
    id: '2',
    name: 'MacBook Pro 14"',
    price: '₦2,450,000',
    rawPrice: 2450000,
    image:
      'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&q=80&w=800',
    category: 'Laptops',
    rating: 4.9,
    reviews: 89,
    inStock: true,
    specs: {
      screen: '14.2"',
      storage: '512GB',
      processor: 'M3 Pro',
    },
  },
  {
    id: '3',
    name: 'Sony WH-1000XM5',
    price: '₦450,000',
    rawPrice: 450000,
    originalPrice: '₦500,000',
    image:
      'https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?auto=format&fit=crop&q=80&w=800',
    category: 'Audio',
    rating: 4.7,
    reviews: 256,
    inStock: true,
    specs: {
      type: 'Over-ear',
      battery: '30h',
      noiseCancelling: 'Yes',
    },
  },
  {
    id: '4',
    name: 'iPad Air 5',
    price: '₦850,000',
    rawPrice: 850000,
    image:
      'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&q=80&w=800',
    category: 'Tablets',
    rating: 4.6,
    reviews: 150,
    inStock: false,
    specs: {
      screen: '10.9"',
      storage: '64GB',
      connectivity: 'Wi-Fi',
    },
  },
  {
    id: '5',
    name: 'Samsung S24 Ultra',
    price: '₦1,850,000',
    rawPrice: 1850000,
    image:
      'https://images.unsplash.com/photo-1610945265078-3858a0828671?auto=format&fit=crop&q=80&w=800',
    category: 'Phones',
    rating: 4.8,
    reviews: 95,
    inStock: true,
    isNew: true,
    specs: {
      screen: '6.8"',
      storage: '256GB',
      color: 'Titanium Gray',
    },
  },
];
