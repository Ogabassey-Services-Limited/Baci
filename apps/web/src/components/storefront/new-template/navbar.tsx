'use client';

import {
  Bell,
  BellOff,
  Menu,
  Search,
  ShoppingCart,
  User,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useStorefrontSafe } from '@/contexts/storefront-context';
import { cn } from '@/lib/utils';
import { asRoute } from '@/lib/routes';
import { useMerchantSafe } from '@/hooks/use-merchant-client';
import { Logo } from '@/components/logo';
import { MobileMenu } from './mobile-menu';
import { SourceRequestModal } from './source-request-modal';

// Mock useNotification for now
const useNotification = () => ({
  notifications: [],
  _markAsRead: () => { },
  _markAllAsRead: () => { },
});

export const Navbar: React.FC = () => {
  const { cartCount } = useCart();
  const storefrontContext = useStorefrontSafe();
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const getHref = (path: string) => path.startsWith('http') ? path : `${basePath}${path}`;
  const { notifications, _markAsRead, _markAllAsRead } =
    useNotification();
  const [query, setQuery] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Sync local query with storefront context search
  const setShowDropdown = (_show: boolean) => { }; // No-op - dropdown removed

  // Notification UI State
  const [showNotifications, setShowNotifications] = useState(false);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Scroll visibility logic
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY && currentScrollY > 10) {
        setIsVisible(false);
        setShowDropdown(false);
        setShowCategoryDropdown(false);
        setShowNotifications(false);
      } else if (currentScrollY < lastScrollY) {
        setIsVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isVisible]);

  // Search Logic - sync with storefront context for product grid filtering
  useEffect(() => {
    // Debounce updating the storefront context
    const timeoutId = setTimeout(() => {
      if (storefrontContext?.setSearchQuery) {
        storefrontContext.setSearchQuery(query);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [query, storefrontContext]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const inSearch = searchRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      const inCategory = categoryRef.current?.contains(target);
      const inNotifications = notificationRef.current?.contains(target);

      if (!inSearch && !inDropdown) {
        setShowDropdown(false);
      }

      if (!inCategory) {
        setShowCategoryDropdown(false);
      }

      if (!inNotifications) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      // Update the storefront context immediately
      if (storefrontContext?.setSearchQuery) {
        storefrontContext.setSearchQuery(query);
      }
      // Scroll to products section if it exists
      const productsSection = document.getElementById('products');
      if (productsSection) {
        productsSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const _openSourceModal = () => setIsSourceModalOpen(true);

  return (
    <>
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-transform duration-300',
          !isVisible && '-translate-y-full'
        )}
      >
        {/* Dark Patterned Header Background */}
        <div className="bg-[#0F0F0F] relative text-white border-b border-white/5">
          {/* Dark Pattern Background Container */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23ffffff'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '140px 140px',
            }}
          />
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-8 relative z-10">
            {/* Logo */}
            <div className="flex items-center gap-4 shrink-0">
              <button
                type="button"
                className="md:hidden p-2 -ml-2 text-white"
                onClick={() => setIsMenuOpen(true)}
                aria-label="Open mobile menu"
              >
                <Menu size={24} />
              </button>
              <Link href={asRoute(getHref('/'))} className="shrink-0">
                <Logo variant="light" width={80} height={28} />
              </Link>
            </div>

            {/* Search Bar */}
            <div
              className="hidden md:flex flex-1 max-w-2xl relative"
              ref={searchRef}
            >
              <form onSubmit={handleSearch} className="w-full relative">
                <input
                  type="text"
                  placeholder="Search for phones, laptops, accessories..."
                  className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:border-(--store-primary) focus:ring-2 focus:ring-(--store-primary)/20 transition-all text-sm font-medium"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => query.trim() && setShowDropdown(true)}
                />
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
              </form>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {/* Notifications */}
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  className="p-2.5 rounded-full hover:bg-white/10 text-white transition-colors relative"
                  onClick={() => setShowNotifications(!showNotifications)}
                  aria-label="Toggle notifications"
                >
                  <Bell size={22} />
                  {/* TODO: notification badge when implemented
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2.5 w-2 h-2 bg-(--store-primary) rounded-full border-2 border-[#0F0F0F]" />
                  )}
                  */}
                </button>

                {/* Notification Dropdown */}
                {showNotifications && (
                  <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
                      <h3 className="font-bold text-gray-900">Notifications</h3>
                      {/* TODO: mark all read when implemented
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllAsRead}
                          className="text-xs font-bold text-(--store-primary) hover:opacity-80"
                        >
                          Mark all read
                        </button>
                      )}
                      */}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notif: any) => (
                          <div
                            key={notif.id}
                            className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-(--store-primary)/5' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div
                                className={`w-2 h-2 mt-2 rounded-full shrink-0 ${!notif.read ? 'bg-(--store-primary)' : 'bg-gray-300'}`}
                              />
                              <div>
                                <p className="text-sm text-gray-800 leading-relaxed">
                                  {notif.message}
                                </p>
                                <span className="text-xs text-gray-400 mt-1 block">
                                  {notif.time}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          <BellOff className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Account */}
              <Link
                href={asRoute(getHref('/profile'))}
                className="hidden sm:flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-white/10 border border-white/20 hover:border-white/40 transition-all group"
              >
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center text-white group-hover:bg-white group-hover:text-(--store-primary) transition-colors">
                  <User size={18} />
                </div>
                <span className="text-sm font-bold text-white">Account</span>
              </Link>

              {/* Cart */}
              <Link href={asRoute(getHref('/cart'))} className="relative group">
                <div className="p-2.5 rounded-full bg-white text-gray-900 group-hover:bg-(--store-primary) group-hover:text-(--store-on-primary,white) transition-colors shadow-lg shadow-black/20">
                  <ShoppingCart size={20} />
                </div>
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-(--store-primary) text-(--store-on-primary,white) text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {cartCount}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SourceRequestModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        initialQuery={query}
      />

      <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
};
