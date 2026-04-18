'use client';

import { Heart, Home, ShoppingCart, User, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';

import { useCart } from '@/hooks/cart';
import { asRoute } from '@/lib/routes';
import { useOgabasseyScrollVisibility } from '../scroll-visibility-store';

interface MobileFooterProps {
  storeSlug?: string;
}

/**
 * Mobile Footer Navigation - 2025 Best Practices Implementation
 *
 * Key features:
 * - 5 items max (UX standard for mobile nav)
 * - Smart scroll hide with debouncing (not too aggressive)
 * - Safe area padding for iOS/browser toolbar zones
 * - Outline → filled icon state transitions
 * - Haptic-style visual feedback on tap
 * - No overflow-hidden (prevents badge clipping)
 * - Higher z-index (z-50) for proper layering
 */
export const MobileFooter: React.FC<MobileFooterProps> = ({ storeSlug = '' }) => {
  const { totalItems } = useCart();
  const pathname = usePathname();
  const isVisible = useOgabasseyScrollVisibility();

  // Build store-relative path - handle both with and without leading slash
  const normalizedSlug = storeSlug.startsWith('/') ? storeSlug : (storeSlug ? `/${storeSlug}` : '');
  const basePath = normalizedSlug;

  // Active state logic
  const isActive = (path: string) => {
    const fullPath = `${basePath}${path}`;
    if (path === '/account') {
      return pathname?.startsWith(`${basePath}/account`) || false;
    }
    if (path === '/') {
      return pathname === basePath || pathname === `${basePath}/`;
    }
    return pathname === fullPath || pathname?.startsWith(`${fullPath}/`) || false;
  };

  // Navigation items configuration
  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/wishlist', icon: Heart, label: 'Saved' },
    { path: '/cart', icon: ShoppingCart, label: 'Cart', badge: totalItems },
    { path: '/wallet', icon: Wallet, label: 'Wallet' },
    { path: '/account', icon: User, label: 'Account' },
  ];

  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className={`fixed bottom-0 left-0 right-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-md border-t border-white/10 md:hidden transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
      style={{
        // Safe area inset for iOS devices and browser toolbar zones
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      {/* Subtle top highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Background Pattern - Matching Header Style with specific opacity */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none overflow-hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- ULTRA SPARSE --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3C/g%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '140px 140px',
        }}
      />

      <div className="flex items-center justify-around px-2 py-3 relative z-10">
        {navItems.map(({ path, icon: Icon, label, badge }) => {
          const active = isActive(path);

          return (
            <Link
              key={path}
              href={asRoute(`${basePath}${path}`)}
              prefetch={false}
              className={
                `relative flex flex-col items-center justify-center min-w-[56px] py-1 active:scale-90 transition-transform duration-150`
              }
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              {/* Icon container */}
              <div className={`
                relative p-2 rounded-xl transition-[background-color,color] duration-200
                ${active
                  ? 'text-white bg-white/10'
                  : 'text-gray-400 hover:text-gray-300'
                }
              `}>
                <Icon
                  size={24}
                  strokeWidth={active ? 2.5 : 1.75}
                  fill={active ? 'currentColor' : 'none'}
                  className="transition-[stroke-width] duration-200"
                />

                {/* Badge for cart count */}
                {badge !== undefined && badge > 0 && (
                  <span
                    className="absolute -top-1 -right-1
                               bg-primary text-white text-[10px] font-bold
                               min-w-[18px] h-[18px]
                               flex items-center justify-center
                               rounded-full
                               shadow-lg shadow-primary/30
                               animate-in zoom-in-50 duration-200"
                    aria-label={`${badge} items in cart`}
                  >
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>

              {/* Label - only shown for active item */}
              <span className={`
                text-[10px] font-medium mt-1 transition-opacity duration-200
                ${active ? 'text-white opacity-100' : 'text-gray-500 opacity-0 h-0'}
              `}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export { MobileFooter as OgabasseyMobileFooter };
