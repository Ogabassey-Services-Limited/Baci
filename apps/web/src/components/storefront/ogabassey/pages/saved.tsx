'use client';

import { Heart, ShoppingCart } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';
import { getStorefrontProductHref } from '@/lib/storefront-product-href';

interface SavedProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  image: string;
}

// Mock saved items data
const initialSavedItems: SavedProduct[] = [
  {
    id: '1',
    name: 'iPhone 15 Pro Max',
    description: '256GB, Natural Titanium - A17 Pro chip with 6-core GPU',
    price: '₦1,950,000',
    image:
      '/placeholder.png',
  },
  {
    id: '2',
    name: 'MacBook Pro 14"',
    description: 'M3 Pro chip, 18GB RAM, 512GB SSD, Space Gray',
    price: '₦2,450,000',
    image:
      '/placeholder.png',
  },
  {
    id: '3',
    name: 'Sony WH-1000XM5',
    description: 'Premium Noise Cancelling Wireless Headphones',
    price: '₦450,000',
    image:
      '/placeholder.png',
  },
  {
    id: '4',
    name: 'Samsung Galaxy Watch 6',
    description: '44mm, Graphite, Bluetooth + LTE',
    price: '₦280,000',
    image:
      '/placeholder.png',
  },
];

export const OgabasseyV2SavedItems: React.FC = () => {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath ?? '';
  const [savedItems, setSavedItems] =
    useState<SavedProduct[]>(initialSavedItems);

  const removeFromSaved = (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-white pb-24 pt-4 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2 shrink-0">
          <Heart className="text-red-600 fill-red-600" />
          Saved Items
        </h1>

        {savedItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="text-red-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">
                No saved items yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Tap the heart icon on products you like to add them to your
                wishlist.
              </p>
              <Link
                href={asRoute(basePath)}
                className="inline-block bg-red-600 text-white font-bold py-2.5 px-6 rounded-xl text-sm hover:bg-red-700 transition-colors"
              >
                Start Shopping
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {savedItems.map((product) => (
              <div
                key={product.id}
                className="bg-white border border-gray-100 rounded-2xl p-3 md:p-4 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col relative"
              >
                <Link
                  href={asRoute(getStorefrontProductHref(product, basePath))}
                  className="absolute inset-0 z-0"
                />

                <div className="relative aspect-square mb-3 bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden z-10 pointer-events-none">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-contain mix-blend-multiply p-4"
                  />
                </div>

                <div className="flex flex-col flex-1 pointer-events-none">
                  <h3 className="font-bold text-gray-900 mb-1 truncate text-sm md:text-base">
                    {product.name}
                  </h3>
                  <p className="text-gray-500 text-xs mb-3 line-clamp-2 hidden md:block">
                    {product.description}
                  </p>

                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-red-600 font-bold text-sm md:text-lg">
                      {product.price}
                    </span>
                  </div>
                </div>

                <div className="mt-3 z-20 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 bg-gray-900 text-white text-[10px] md:text-xs font-bold py-2 md:py-2.5 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ShoppingCart size={14} />
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromSaved(product.id)}
                    className="p-2 border border-gray-200 rounded-lg hover:border-red-200 hover:bg-red-50 text-red-600 transition-colors flex items-center justify-center"
                  >
                    <Heart size={16} className="fill-current" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
