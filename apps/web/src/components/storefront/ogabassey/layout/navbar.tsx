'use client';
// Template preview

import {
  Bell,
  Check,
  ChevronDown,
  Gamepad2,
  Gift,
  Headphones,
  Laptop,
  LayoutGrid,
  Menu,
  Package,
  Printer,
  ScanBarcode,
  Search,
  Shield,
  ShoppingCart,
  Smartphone,
  User,
  Wallet,
  Wrench,
  Newspaper,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { SearchAutocomplete } from '@/components/storefront/search-autocomplete';
import { Logo } from './logo';
import { MobileMenu } from './mobile-menu';
import { GadgetPattern } from '../components/GadgetPattern';
import { EmptyState } from '../components/empty-state';

interface NavbarProps {
  logo?: string;
  storeName?: string;
  storeSlug?: string;
  showSearch?: boolean;
  showCart?: boolean;
  showUser?: boolean;
  showBell?: boolean;
}

export const OgabasseyNavbar: React.FC<NavbarProps> = ({
  logo,
  storeName,
  storeSlug,
  showSearch = true,
  showCart = true,
  showUser = true,
  showBell = true,
}) => {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const { totalItems, setIsCartOpen } = useCart();
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const merchantContext = useMerchantSafe();
  const merchant = merchantContext?.merchant;
  // const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  // Temporary notification state until NotificationContext is migrated
  const notifications: {
    id: string;
    message: string;
    type: 'order' | 'promo' | 'security';
    title: string;
    time: string;
    read: boolean;
  }[] = [];
  const unreadCount = 0;
  const markAsRead = (_id: string) => { };
  const markAllAsRead = () => { };
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Detect if we're on the blog page
  const isBlogPage = pathname?.includes('/blog');

  // Safely construct base path to prevent CodeQL DOM text reinterpretation alerts
  // CodeQL recognizes that starting with '/' prevents javascript: URIs.
  const basePath = storeSlug ? (storeSlug.startsWith('/') ? encodeURI(storeSlug) : `/${encodeURIComponent(storeSlug)}`) : '';

  // Notification UI State
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  // Initialize with false for SSR consistency, then hydrate from localStorage
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [categories, setCategories] = useState<Array<{ name: string; slug: string; icon: any }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [_isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Scroll visibility logic
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const SCROLL_THRESHOLD = 5; // Reduced threshold for responsiveness

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY.current;

      // Immediate state update without debounce
      if (scrollDelta > SCROLL_THRESHOLD && currentScrollY > 100) {
        setIsVisible(false);
      } else if (scrollDelta < -5 || currentScrollY < 50) {
        setIsVisible(true);
      }
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Hydrate notificationsEnabled from localStorage after mount (SSR-safe)
  useEffect(() => {
    const stored = localStorage.getItem('notifications-enabled');
    if (stored === 'true') {
      setNotificationsEnabled(true);
    }
  }, []);

  // Handle product selection from search autocomplete
  const handleProductSelect = (url: string) => {
    // Validate URL before navigation
    const isValidRelativePath =
      url.startsWith('/') &&
      !url.startsWith('//') &&
      !url.includes('\\') &&
      !/^https?:\/\//i.test(url);

    if (isValidRelativePath) {
      // Prepend normalized basePath if present - SearchAutocomplete returns URL without it
      const fullUrl = basePath ? `${basePath}${url}` : url;
      router.push(fullUrl as `/${string}`);
    } else {
      console.warn('Invalid product URL rejected:', url);
    }
  };

  // Close dropdowns when clicking outside
  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const inCategory = categoryRef.current?.contains(target);
      const inNotifications = notificationRef.current?.contains(target);

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
    const trimmedQuery = searchQuery.trim().slice(0, 100); // Limit to 100 chars
    if (!trimmedQuery) return;
    // If on blog page, search blog posts; otherwise search products
    if (isBlogPage) {
      router.push(`${basePath}/blog?search=${encodeURIComponent(trimmedQuery)}` as `/${string}`);
    } else {
      router.push(`${basePath}/search?q=${encodeURIComponent(trimmedQuery)}` as `/${string}`);
    }
  };

  const openSourceModal = () => {
    // setShowDropdown(false);
    setIsSourceModalOpen(true);
  };

  // Icon mapping for categories
  const getCategoryIcon = (categoryName: string) => {
    const name = categoryName.toLowerCase();
    if (name.includes('phone') || name.includes('smartphone')) return Smartphone;
    if (name.includes('laptop') || name.includes('computer')) return Laptop;
    if (name.includes('gaming') || name.includes('game')) return Gamepad2;
    if (name.includes('accessory') || name.includes('accessories')) return Headphones;
    if (name.includes('printer')) return Printer;
    if (name.includes('tablet')) return Laptop;
    if (name.includes('watch') || name.includes('wearable')) return Shield;
    if (name.includes('audio') || name.includes('speaker') || name.includes('headphone')) return Headphones;
    return Package; // Default icon
  };

  // Get categories from server-provided context (fetched server-side for SEO)
  useEffect(() => {
    if (merchantContext?.navigationCategories) {
      const mappedCategories = merchantContext.navigationCategories.map((cat) => ({
        name: cat.name,
        slug: cat.slug,
        icon: getCategoryIcon(cat.name),
      }));
      setCategories(mappedCategories);
    }
  }, [merchantContext?.navigationCategories]);

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
                    className="flex items-center cursor-pointer select-none active:opacity-80 transition-opacity text-white"
                  >
                    <Logo className="h-8 w-auto" />
                  </Link>
                </div>
              </div>

              {/* Search Bar - Full Width Mobile, Center Desktop */}
              {merchant?.id && (
                <div className="w-full md:flex-1 md:max-w-2xl md:mx-auto relative">
                  {isBlogPage ? (
                    // Blog search - simple input that searches blog posts
                    <form onSubmit={handleSearch} className="relative">
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search blog posts..."
                        maxLength={100}
                        aria-label="Search blog posts"
                        id="blog-search-input"
                        name="search"
                        className="w-full h-11 md:h-12 bg-white rounded-md border-0 text-gray-800 placeholder-gray-500 text-[15px] focus:ring-2 focus:ring-primary/50 pl-10 pr-4"
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    </form>
                  ) : (
                    // Product search with autocomplete
                    <SearchAutocomplete
                      merchantId={merchant.id}
                      value={searchQuery}
                      onChange={setSearchQuery}
                      onSelectProduct={handleProductSelect}
                      placeholder="Search products, brands and categories"
                      className="[&_input]:h-11 md:[&_input]:h-12 [&_input]:bg-white [&_input]:rounded-md [&_input]:border-0 [&_input]:text-gray-800 [&_input]:placeholder-gray-500 [&_input]:text-[15px] [&_input]:focus:ring-2 [&_input]:focus:ring-primary/50"
                    />
                  )}
                </div>
              )}

              {/* Desktop Right Icons */}
              <div className="hidden md:flex items-center gap-5 shrink-0 text-white/80">
                {/* Notification Icon & Dropdown */}
                <div className="relative flex items-center" ref={notificationRef}>
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative flex items-center justify-center hover:text-white transition-colors ${showNotifications ? 'text-white' : ''}`}
                  >
                    <Bell size={22} />
                    {/* TODO: Add notification badge when notifications are implemented
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-[#1a1a1a]" />
                    )}
                    */}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                    <div className="absolute top-full right-0 mt-4 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-0 animate-in fade-in slide-in-from-top-2 z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-900 text-sm">
                          Notifications
                        </h3>
                        {/* TODO: Add mark all read when notifications are implemented
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-[10px] font-bold text-primary hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                        */}
                      </div>
                      <div className="max-h-[300px] overflow-y-auto">
                        {unreadCount === 0 ? (
                          <EmptyState
                            variant="notifications"
                            title="No Notifications"
                            description="You have no unread notifications at this time."
                            compact
                          />
                        ) : (
                          notifications
                            .filter((n) => !n.read)
                            .map((n) => (
                              <div
                                key={n.id}
                                className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 relative group"
                              >
                                <div className="flex gap-3">
                                  <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.type === 'order' ? 'bg-blue-50 text-blue-600' : n.type === 'promo' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'}`}
                                  >
                                    {n.type === 'order' ? (
                                      <Package size={14} />
                                    ) : n.type === 'promo' ? (
                                      <Gift size={14} />
                                    ) : (
                                      <Shield size={14} />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className="text-xs font-bold text-gray-900 mb-0.5">
                                      {n.title}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 leading-tight mb-1">
                                      {n.message}
                                    </p>
                                    <span className="text-[10px] text-gray-400">
                                      {n.time}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => markAsRead(n.id)}
                                    className="absolute top-3 right-3 text-gray-300 hover:text-green-600 opacity-0 group-hover:opacity-100 transition-all bg-white rounded-full p-0.5 shadow-sm"
                                    title="Mark as read"
                                  >
                                    <Check size={14} />
                                  </button>
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
                        <Link
                          href={`${basePath}/account` as `/${string}`}
                          onClick={() => setShowNotifications(false)}
                          className="text-[10px] font-bold text-gray-600 hover:text-gray-900 block py-1"
                        >
                          View All
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href={`${basePath}/cart` as `/${string}`}
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
                  className="flex items-center justify-center hover:text-white transition-colors"
                >
                  <User size={22} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECONDARY NAVIGATION ROW (WHITE) --- */}
        <div className="bg-white border-b border-gray-200 relative z-10 hidden md:block">
          {/* Light Pattern Background */}
          <div
            className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23000000'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23000000'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '140px 140px',
            }}
          />

          <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10">
            <div className="flex items-center gap-6 h-12">
              {/* Shop by Category Collapsible */}
              <div className="relative" ref={categoryRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1 ${showCategoryDropdown ? 'text-primary' : ''}`}
                >
                  <LayoutGrid size={18} />
                  Shop by Category
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="absolute -top-1.5 left-8 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100" />
                    {categories.length > 0 ? (
                      categories.map((cat) => (
                        <Link
                          key={cat.slug}
                          href={`${basePath}/${encodeURIComponent(cat.slug)}` as `/${string}`}
                          onClick={() => setShowCategoryDropdown(false)}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-primary/10 hover:text-primary transition-colors group"
                        >
                          <cat.icon
                            size={18}
                            className="text-gray-400 group-hover:text-primary transition-colors"
                          />
                          <span className="font-medium text-gray-700 group-hover:text-red-900">
                            {cat.name}
                          </span>
                        </Link>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-gray-500">Loading categories...</div>
                    )}
                  </div>
                )}
              </div>

              <div className="h-4 w-px bg-gray-200" />

              {/* IMEI Checker */}
              <Link
                href={`${basePath}/imei-check` as `/${string}`}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
              >
                <ScanBarcode size={18} />
                IMEI Checker
              </Link>

              <div className="h-4 w-px bg-gray-200" />

              {/* Repairs */}
              <Link
                href={`${basePath}/repairs` as `/${string}`}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
              >
                <Wrench size={18} />
                Repairs
              </Link>

              <div className="h-4 w-px bg-gray-200" />

              {/* Wallet */}
              <Link
                href={`${basePath}/wallet` as `/${string}`}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
              >
                <Wallet size={18} />
                Wallet
              </Link>

              <div className="h-4 w-px bg-gray-200" />

              {/* Blog */}
              <Link
                href={`${basePath}/blog` as `/${string}`}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-primary transition-colors px-1 py-1"
              >
                <Newspaper size={18} />
                Blog
              </Link>
            </div>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />
    </>
  );
};
