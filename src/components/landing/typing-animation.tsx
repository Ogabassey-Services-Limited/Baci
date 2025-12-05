'use client';

import { useEffect, useState } from 'react';

// Comprehensive list of store types covering major e-commerce categories
// Every word MUST make grammatical sense when followed by "Store"
const words = [
  // Fashion & Apparel
  'Fashion',
  'Clothing',
  'Boutique',
  'Streetwear',
  'Vintage',
  'Apparel',

  // Technology & Electronics
  'Electronics',
  'Gadget',
  'Phone',
  'Tech',
  'Computer',
  'Gaming',

  // Beauty & Personal Care
  'Beauty',
  'Cosmetics',
  'Skincare',
  'Makeup',
  'Wellness',
  'Fragrance',

  // Food & Beverage
  'Grocery',
  'Food',
  'Bakery',
  'Coffee',
  'Organic',
  'Gourmet',

  // Home & Living
  'Furniture',
  'Home Decor',
  'Interior',
  'Lifestyle',
  'Bedding',

  // Sports & Fitness
  'Fitness',
  'Sports',
  'Activewear',
  'Gym',
  'Outdoor',
  'Athletic',

  // Kids & Baby
  'Kids',
  'Baby',
  'Toy',
  "Children's",
  'Nursery',

  // Jewelry & Accessories
  'Jewelry',
  'Accessories',
  'Watch',
  'Handmade',
  'Gift',

  // Books & Media
  'Book',
  'Bookstore',
  'Comic',
  'Media',

  // Pet Supplies
  'Pet',
  'Pet Supply',
  'Animal',

  // Arts & Crafts
  'Art',
  'Craft',
  'Hobby',
  'DIY',

  // Health & Supplements
  'Health',
  'Supplement',
  'Vitamin',
  'Nutrition',

  // Automotive
  'Auto Parts',
  'Car',
  'Automotive',

  // Specialty
  'Luxury',
  'Artisan',
  'Thrift',
  'Antique',
];

/**
 * CSS-only typing animation for landing page hero.
 * Removed framer-motion dependency to reduce JavaScript bundle size (~50KB savings).
 * Uses CSS animations for slide-in/out effect with GPU-accelerated transforms.
 */
export function TypingAnimation() {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      // Wait for exit animation, then change word
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        setIsAnimating(false);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex justify-start min-w-[1ch] relative z-10 overflow-hidden">
      <span className="sr-only">E-commerce</span>
      <span
        key={words[index]}
        aria-hidden="true"
        className={`
          inline-block bg-gradient-to-r from-accent to-orange-500
          bg-clip-text text-transparent whitespace-nowrap pb-2
          transition-all duration-300 ease-out
          ${isAnimating ? 'opacity-0 -translate-y-5' : 'opacity-100 translate-y-0'}
        `}
      >
        {words[index]}
      </span>
    </span>
  );
}
