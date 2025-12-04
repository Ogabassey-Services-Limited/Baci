'use client';

import { AnimatePresence, motion } from 'framer-motion';
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

export function TypingAnimation() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-flex justify-start min-w-[1ch] relative z-10">
      <span className="sr-only">E-commerce</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[index]}
          aria-hidden="true"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="inline-block bg-gradient-to-r from-accent to-orange-500 bg-clip-text text-transparent whitespace-nowrap pb-2"
        >
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
