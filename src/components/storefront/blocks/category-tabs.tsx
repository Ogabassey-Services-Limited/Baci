'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  links: {
    label: string;
    url: string;
  }[];
  className?: string;
}

export function CategoryTabs({ links, className }: CategoryTabsProps) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'w-full border-b border-gray-100 bg-white sticky top-0 z-40',
        className
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-8 overflow-x-auto no-scrollbar py-4 -mb-px">
          {links.map((link, index) => {
            const isActive = pathname === link.url;
            return (
              <Link
                key={index}
                href={link.url as '/'}
                className={cn(
                  'text-sm font-medium whitespace-nowrap transition-colors pb-1 border-b-2',
                  isActive
                    ? 'text-gray-900 border-gray-900'
                    : 'text-gray-500 border-transparent hover:text-gray-900 hover:border-gray-300'
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
