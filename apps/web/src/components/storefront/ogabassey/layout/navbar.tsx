'use client';

import {
  Menu,
  ShoppingCart,
  User,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { Logo } from './logo';
import { GadgetPattern } from '../components/GadgetPattern';
import { useOgabasseyScrollVisibility } from '../scroll-visibility-store';
import { NavbarNotifications } from './navbar-notifications';
import { NavbarSearch } from './navbar-search';
import { NavbarSecondaryNav } from './navbar-secondary-nav';

interface NavbarProps {
  storeSlug?: string;
}

const DeferredMobileMenu = dynamic(
  () => import('./mobile-menu').then((mod) => mod.MobileMenu),
  { ssr: false }
);

export const OgabasseyNavbar: React.FC<NavbarProps> = ({
  storeSlug,
}) => {
  const { totalItems, setIsCartOpen } = useCart();
  const merchantContext = useMerchantSafe();
  const merchantId = merchantContext?.merchant?.id;
  const pathname = usePathname();
  const isBlogPage = pathname?.includes('/blog');
  const basePath = storeSlug
    ? storeSlug.startsWith('/')
      ? encodeURI(storeSlug)
      : `/${encodeURIComponent(storeSlug)}`
    : '';
  const categories =
    merchantContext?.navigationCategories?.map((category) => ({
      name: category.name,
      slug: category.slug,
    })) ?? [];
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isVisible = useOgabasseyScrollVisibility();

  return (
    <>
      <header
        className={`sticky top-0 z-50 shadow-md transition-transform duration-200 ease-out will-change-transform ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
      >
        {/* --- TOP HEADER ROW (BLACK) --- */}
        <div className="bg-[#0F0F0F] relative z-20 text-white">
          {/* Dark Pattern Background Container - Optimized CSS-only implementation */}
          {/* Dark Pattern Background Container - Restored Gadget Pattern */}
          <GadgetPattern opacity={0.1} />

          <div className="max-w-[1400px] mx-auto relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 pt-3 pb-5 md:py-4 px-4 md:px-6">
              {/* Header Row: Menu, Logo, Icons (Mobile: Spaced out | Desktop: Grouped Left) */}
              <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
                {/* Left: Menu & Logo */}
                <div className="flex items-center gap-4 shrink-0">
                  <button
                    onClick={() => setIsMenuOpen(true)}
                    className="text-white transition-colors active:text-white"
                  >
                    <Menu className="h-6 w-6" />
                  </button>

                  <Link
                    href={(basePath || '/') as `/${string}`}
                    prefetch={false}
                    className="flex items-center cursor-pointer select-none active:opacity-80 transition-opacity text-white"
                  >
                    <Logo className="h-8 w-auto" />
                  </Link>
                </div>
              </div>

              {/* Search Bar - Full Width Mobile, Center Desktop */}
              {merchantId && (
                <div className="w-full md:flex-1 md:max-w-2xl md:mx-auto relative">
                  <NavbarSearch
                    basePath={basePath}
                    isBlogPage={Boolean(isBlogPage)}
                    merchantId={merchantId}
                  />
                </div>
              )}

              {/* Desktop Right Icons */}
              <div className="hidden md:flex items-center gap-5 shrink-0 text-white/80">
                <NavbarNotifications basePath={basePath} />

                <Link
                  href={`${basePath}/cart` as `/${string}`}
                  prefetch={false}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsCartOpen(true);
                  }}
                  className="relative flex items-center justify-center hover:text-white transition-colors"
                >
                  <ShoppingCart size={22} />
                  <span
                    className={`absolute -top-1.5 -right-1.5 bg-primary text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-gray-950 transition-all ${totalItems > 0 ? 'scale-100' : 'scale-0'}`}
                  >
                    {totalItems}
                  </span>
                </Link>
                <Link
                  href={`${basePath}/account` as `/${string}`}
                  prefetch={false}
                  className="flex items-center justify-center hover:text-white transition-colors"
                >
                  <User size={22} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        <NavbarSecondaryNav basePath={basePath} categories={categories} />
      </header>

      {isMenuOpen ? (
        <DeferredMobileMenu
          isOpen={isMenuOpen}
          onClose={() => setIsMenuOpen(false)}
        />
      ) : null}
    </>
  );
};
