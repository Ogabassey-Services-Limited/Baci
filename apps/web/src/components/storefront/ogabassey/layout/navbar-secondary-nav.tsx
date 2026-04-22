'use client';

import {
  ChevronDown,
  Gamepad2,
  Headphones,
  Laptop,
  LayoutGrid,
  Newspaper,
  Package,
  Printer,
  ScanBarcode,
  Shield,
  Smartphone,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';

interface NavigationCategory {
  name: string;
  slug: string;
}

interface NavbarSecondaryNavProps {
  basePath: string;
  categories: NavigationCategory[];
}

function getCategoryIcon(categoryName: string) {
  const name = categoryName.toLowerCase();
  if (name.includes('phone') || name.includes('smartphone')) {
    return Smartphone;
  }
  if (name.includes('laptop') || name.includes('computer')) {
    return Laptop;
  }
  if (name.includes('gaming') || name.includes('game')) {
    return Gamepad2;
  }
  if (name.includes('accessory') || name.includes('audio') || name.includes('speaker') || name.includes('headphone')) {
    return Headphones;
  }
  if (name.includes('printer')) {
    return Printer;
  }
  if (name.includes('tablet')) {
    return Laptop;
  }
  if (name.includes('watch') || name.includes('wearable')) {
    return Shield;
  }
  return Package;
}

export function NavbarSecondaryNav({
  basePath,
  categories,
}: NavbarSecondaryNavProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showCategoryDropdown) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!categoryRef.current?.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCategoryDropdown]);

  return (
    <div className="bg-white border-b border-gray-200 relative z-10 hidden md:block">
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1.5'%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23000000'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23000000'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '140px 140px',
        }}
      />

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10">
        <div className="flex items-center gap-6 h-12">
          <div className="relative" ref={categoryRef}>
            <button
              onClick={() => setShowCategoryDropdown((current) => !current)}
              className={`flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1 ${showCategoryDropdown ? 'text-primary' : ''}`}
            >
              <LayoutGrid size={18} />
              Shop by Category
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showCategoryDropdown && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                <div className="absolute -top-1.5 left-8 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100" />
                {categories.length > 0 ? (
                  categories.map((category) => {
                    const Icon = getCategoryIcon(category.name);
                    const normalizedCategorySlug = normalizeStorefrontCategorySlug(
                      category.slug
                    );

                    if (!normalizedCategorySlug) {
                      return null;
                    }

                    return (
                      <Link
                        key={category.slug}
                        href={`${basePath}/${encodeURIComponent(normalizedCategorySlug)}` as `/${string}`}
                        prefetch={false}
                        onClick={() => setShowCategoryDropdown(false)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-primary/10 hover:text-primary transition-colors group"
                      >
                        <Icon
                          size={18}
                          className="text-gray-400 group-hover:text-primary transition-colors"
                        />
                        <span className="font-medium text-gray-700 group-hover:text-red-900">
                          {category.name}
                        </span>
                      </Link>
                    );
                  })
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500">
                    Loading categories...
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-gray-200" />

          <Link
            href={`${basePath}/imei-check` as `/${string}`}
            prefetch={false}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
          >
            <ScanBarcode size={18} />
            IMEI Checker
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <Link
            href={`${basePath}/repairs` as `/${string}`}
            prefetch={false}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
          >
            <Wrench size={18} />
            Repairs
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <Link
            href={`${basePath}/wallet` as `/${string}`}
            prefetch={false}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
          >
            <Wallet size={18} />
            Wallet
          </Link>

          <div className="h-4 w-px bg-gray-200" />

          <Link
            href={`${basePath}/blog` as `/${string}`}
            prefetch={false}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
          >
            <Newspaper size={18} />
            Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
