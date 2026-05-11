'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [isVisible, setIsVisible] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);

      // After fade out, change word and fade in
      timeoutRef.current = setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        setIsVisible(true);
      }, 300);
    }, 3000);

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <span className="inline-flex justify-center min-w-[80px] sm:min-w-[220px] relative z-10">
      <span className="sr-only">E-commerce</span>
      <span
        aria-hidden="true"
        className="inline-block bg-linear-to-r from-accent to-orange-500 bg-clip-text text-transparent whitespace-nowrap pb-2 transition-all duration-300 ease-out"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'translateY(0)' : 'translateY(-20px)',
        }}
      >
        {words[index]}
      </span>
    </span>
  );
}
