'use client';

import Link from 'next/link';
import { renderIcon } from '@/components/builder/icon-registry';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface OgabasseyCategoriesProps {
  categories: {
    label: string;
    icon: string;
    link: string;
  }[];
  backgroundColor?: string;
  iconColor?: string;
}

export function OgabasseyCategories({
  categories = [
    { label: 'Phones', icon: 'smartphone', link: '/category/phones' },
    { label: 'Gaming', icon: 'gamepad', link: '/category/gaming' },
    { label: 'Accessories', icon: 'headphones', link: '/category/accessories' },
    { label: 'Printers', icon: 'printer', link: '/category/printers' },
    { label: 'Laptop', icon: 'laptop', link: '/category/laptops' },
  ],
  backgroundColor = '#FEF2F2', // bg-red-50
  iconColor = '#DC2626', // text-red-600
}: OgabasseyCategoriesProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:hidden mb-4">
        <span className="text-base font-bold">Category</span>
      </div>

      <div className="w-full max-w-screen-lg mx-auto">
        <div className="flex flex-wrap justify-center md:justify-evenly gap-4 md:gap-8">
          {categories.map((category) => (
            <div
              key={category.label}
              className="flex flex-col items-center text-center group"
            >
              <Link
                href={asRoute(category.link)}
                className="flex flex-col items-center gap-3"
              >
                <div
                  className={cn(
                    'w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 shadow-sm hover:shadow-md border-2 border-transparent group-hover:border-red-100'
                  )}
                  style={{ backgroundColor }}
                >
                  <div style={{ color: iconColor }}>
                    {renderIcon(category.icon, {
                      className: 'w-8 h-8 md:w-10 md:h-10',
                    })}
                  </div>
                </div>
                <span className="text-xs md:text-sm font-medium capitalize text-gray-700 group-hover:text-primary transition-colors">
                  {category.label}
                </span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
