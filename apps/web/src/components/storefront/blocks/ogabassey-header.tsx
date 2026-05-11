'use client';

import {
  Bell,
  LayoutGrid,
  Loader2,
  Search,
  ShoppingCart,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Logo } from '@/components/logo';
import { useCart } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';
import {
  type ProductRecommendation,
  searchProductsWithGemini,
} from '@/services/gemini-service-mock';

export interface OgabasseyHeaderProps {
  logoText?: string;
  showSearch?: boolean;
  showCart?: boolean;
  showUser?: boolean;
  showBell?: boolean;
}

export function OgabasseyHeader({
  // logoText = "ogabassey",
  showSearch = true,
  showCart = true,
  showUser = true,
  showBell = true,
}: OgabasseyHeaderProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ProductRecommendation[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { cartCount } = useCart();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setShowResults(true);
    setResults(null); // Clear previous

    try {
      const recommendations = await searchProductsWithGemini(query);
      setResults(recommendations);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="relative z-50">
      {/* Dark Pattern Background Container */}
      <div className="bg-[#1a1a1a] text-white py-3 px-4 md:px-6 relative overflow-hidden">
        {/* Faint gadget pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23ffffff'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '140px 140px',
          }}
        />

        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4 relative z-10">
          {/* Left: Menu & Logo */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              type="button"
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Toggle menu"
            >
              <LayoutGrid size={24} />
            </button>

            {/* Logo */}
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-0.5 cursor-pointer select-none"
            >
              <Logo
                variant="light"
                width={120}
                height={40}
                className="w-auto h-10"
              />
            </Link>
          </div>

          {/* Search Bar - Centered & Wide */}
          {showSearch && (
            <div className="flex-1 max-w-2xl mx-4 lg:mx-12" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative group">
                <div className="relative flex items-center bg-white rounded-md overflow-hidden h-11 transition-all duration-300 focus-within:ring-2 focus-within:ring-red-500/50">
                  <div className="pl-3 pr-2 text-red-600">
                    <Sparkles
                      size={18}
                      className={isSearching ? 'animate-pulse' : ''}
                      fill="currentColor"
                    />
                  </div>
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search or Ask me anything"
                    className="w-full h-full text-gray-800 placeholder-gray-500 bg-transparent outline-hidden font-normal text-[15px]"
                  />
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className={cn(
                      'p-2 text-gray-400 hover:text-gray-600',
                      query ? 'block' : 'hidden'
                    )}
                    aria-label="Clear search"
                  >
                    <X size={16} />
                  </button>
                  <div className="h-6 w-px bg-gray-200 mx-1" />
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="px-4 h-full text-gray-500 hover:text-red-600 transition-colors"
                    aria-label="Submit search"
                  >
                    {isSearching ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <Search size={20} />
                    )}
                  </button>
                </div>

                {/* Search Results Dropdown */}
                {showResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="p-4">
                      {isSearching ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                          <Loader2 className="animate-spin mb-2" size={32} />
                          <p className="text-sm font-medium">
                            Gemini is thinking...
                          </p>
                        </div>
                      ) : results && results.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                            <Sparkles size={16} className="text-red-500" />
                            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                              AI Recommendations
                            </h3>
                          </div>
                          <ul className="space-y-3">
                            {results.map((item) => (
                              <li
                                key={item.name}
                                className="flex justify-between items-start group cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors"
                              >
                                <div>
                                  <p className="font-bold text-gray-900 group-hover:text-red-600 transition-colors">
                                    {item.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                    {item.reason}
                                  </p>
                                </div>
                                <span className="font-bold text-red-600 whitespace-nowrap ml-4">
                                  {item.price}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                            <button
                              type="button"
                              className="text-xs font-semibold text-red-600 hover:underline"
                            >
                              View all results
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-gray-500">
                          <p>No specific AI recommendations found.</p>
                          <p className="text-xs mt-1">
                            Try asking "Best laptop for gaming" or "Cheap
                            phones"
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </form>
            </div>
          )}

          {/* Right Icons */}
          <div className="flex items-center gap-5 shrink-0 text-white/80">
            {showBell && (
              <button
                type="button"
                className="relative hover:text-white transition-colors"
                aria-label="Notifications"
              >
                <Bell size={22} />
              </button>
            )}
            {showCart && (
              <button
                type="button"
                className="relative hover:text-white transition-colors"
                aria-label={`Shopping cart with ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`}
              >
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-[#1a1a1a]">
                    {cartCount}
                  </span>
                )}
              </button>
            )}
            {showUser && (
              <button
                type="button"
                className="hover:text-white transition-colors"
                aria-label="User account"
              >
                <User size={22} />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
