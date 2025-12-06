'use client';

import {
  Bell,
  BellOff,
  ChevronDown,
  Gamepad2,
  Headphones,
  Laptop,
  LayoutGrid,
  Menu,
  Printer,
  ScanBarcode,
  Search,
  ShoppingCart,
  Smartphone,
  User,
  Wallet,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';
import { SourceRequestModal } from './source-request-modal';

// Mock useNotification for now
const useNotification = () => ({
  notifications: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllAsRead: () => {},
});

// Mock products for search
const products: any[] = [];

const NAV_CATEGORIES = [
  { name: 'Phones', icon: Smartphone },
  { name: 'Laptops', icon: Laptop },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'Audio', icon: Headphones },
  { name: 'Accessories', icon: Printer },
];

export const Navbar: React.FC = () => {
  const { cartCount } = useCart();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotification();
  const [query, setQuery] = useState('');
  const [_searchResults, setSearchResults] = useState<any[]>([]);
  const [_showDropdown, setShowDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Notification UI State
  const [showNotifications, setShowNotifications] = useState(false);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

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

  // Search Logic
  useEffect(() => {
    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      const results = products.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.category.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery)
      );
      setSearchResults(results);
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [query]);

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
      router.push(`/search?q=${encodeURIComponent(query)}`);
      setShowDropdown(false);
    }
  };

  const _openSourceModal = () => setIsSourceModalOpen(true);

  return (
    <>
      <div
        className={cn(
          'fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-transform duration-300',
          !isVisible && '-translate-y-full'
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-20 flex items-center justify-between gap-8">
          {/* Logo */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              className="md:hidden p-2 -ml-2 text-gray-700"
              onClick={() => setIsMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <Link href="/" className="shrink-0">
              <Logo />
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
                className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all text-sm font-medium"
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
                className="p-2.5 rounded-full hover:bg-gray-100 text-gray-700 transition-colors relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={22} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="font-bold text-gray-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs font-bold text-red-600 hover:text-red-700"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length > 0 ? (
                      notifications.map((notif: any) => (
                        <div
                          key={notif.id}
                          className={`p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!notif.read ? 'bg-red-50/30' : ''}`}
                        >
                          <div className="flex gap-3">
                            <div
                              className={`w-2 h-2 mt-2 rounded-full shrink-0 ${!notif.read ? 'bg-red-500' : 'bg-gray-300'}`}
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
              href="/profile"
              className="hidden sm:flex items-center gap-2 p-1.5 pr-3 rounded-full hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-all group"
            >
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 group-hover:bg-white group-hover:text-red-600 transition-colors">
                <User size={18} />
              </div>
              <span className="text-sm font-bold text-gray-700">Account</span>
            </Link>

            {/* Cart */}
            <Link href="/cart" className="relative group">
              <div className="p-2.5 rounded-full bg-gray-900 text-white group-hover:bg-red-600 transition-colors shadow-lg shadow-gray-200 group-hover:shadow-red-200">
                <ShoppingCart size={20} />
              </div>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Secondary Nav */}
        <div className="hidden md:block border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10">
            <div className="flex items-center gap-6 h-12">
              {/* Shop by Category Collapsible */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={cn(
                    'flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1',
                    showCategoryDropdown && 'text-red-600'
                  )}
                >
                  <LayoutGrid size={18} />
                  Shop by Category
                  <ChevronDown
                    size={14}
                    className={cn(
                      'transition-transform duration-200',
                      showCategoryDropdown && 'rotate-180'
                    )}
                  />
                </button>

                {/* Dropdown Menu */}
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="absolute -top-1.5 left-8 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100" />
                    {NAV_CATEGORIES.map((cat) => {
                      return (
                        <a
                          key={cat.name}
                          href={`/category/${cat.name.toLowerCase()}`}
                          onClick={() => setShowCategoryDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 hover:text-red-600 transition-colors group"
                        >
                          <cat.icon
                            size={18}
                            className="text-gray-400 group-hover:text-red-600 transition-colors"
                          />
                          <span className="font-medium text-gray-700 group-hover:text-red-900">
                            {cat.name}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-gray-200" />

              {/* IMEI Checker */}
              <Link
                href="/imei-check"
                className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1"
              >
                <ScanBarcode size={18} />
                IMEI Checker
              </Link>

              <div className="h-4 w-px bg-gray-200" />

              {/* Repairs */}
              <Link
                href="/repairs"
                className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1"
              >
                <Wrench size={18} />
                Repairs
              </Link>

              <div className="h-4 w-px bg-gray-200" />

              {/* Wallet */}
              <Link
                href="/wallet"
                className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1"
              >
                <Wallet size={18} />
                Wallet
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
