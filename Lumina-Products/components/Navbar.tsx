import React, { useState, useRef, useEffect } from 'react';
import { Search, ShoppingCart, Bell, User, Loader2, Sparkles, X, LayoutGrid, Menu, AlertCircle, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { searchProductsWithGemini } from '../services/geminiService';
import { ProductRecommendation } from '../types';
import { useCart } from '../contexts/CartContext';
import { Logo } from './Logo';

export const Navbar: React.FC = () => {
  const { totalItems, setIsCartOpen } = useCart();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<ProductRecommendation[] | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Scroll visibility logic
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Optimization: Only update state if visibility needs to change
      if (currentScrollY > lastScrollY && currentScrollY > 10) {
        // Scrolling DOWN
        if (isVisible) setIsVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling UP
        if (!isVisible) setIsVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY, isVisible]);

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
      console.error("Search failed", error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <header 
      className={`sticky top-0 z-50 bg-[#0F0F0F] border-b border-white/5 shadow-md transition-transform duration-200 ease-out will-change-transform ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      {/* Simplified Dark Pattern Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden" 
            style={{ 
              backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
              backgroundSize: '24px 24px'
            }}>
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 pb-0 pt-1 md:py-5 px-4 md:px-6">
          
          {/* Header Row: Menu, Logo, Icons (Mobile: Spaced out | Desktop: Grouped Left) */}
          <div className="flex items-center justify-between md:justify-start w-full md:w-auto gap-4">
             {/* Left: Menu & Logo */}
             <div className="flex items-center gap-4 shrink-0">
                <button className="text-white md:text-gray-400 md:hover:text-white transition-colors">
                   <Menu size={26} className="md:hidden" strokeWidth={1.5} />
                   <LayoutGrid size={24} className="hidden md:block" />
                </button>

                <Link to="/" className="flex items-center cursor-pointer select-none">
                  <Logo className="h-5 md:h-8 w-auto" />
                </Link>
             </div>

             {/* Mobile: Right Icons shown here */}
             <div className="flex md:hidden items-center gap-4 text-white">
                <button 
                  className="relative p-1 active:scale-95 transition-transform"
                  onClick={() => setIsCartOpen(true)}
                >
                  <ShoppingCart size={22} strokeWidth={1.5} />
                  <span className={`absolute -top-0.5 -right-0.5 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-[#0F0F0F] transition-all ${totalItems > 0 ? 'scale-100' : 'scale-0'}`}>
                    {totalItems}
                  </span>
                </button>
                <button className="relative active:scale-95 transition-transform">
                  <Bell size={22} strokeWidth={1.5} />
                </button>
                <button className="relative active:scale-95 transition-transform">
                  <User size={22} strokeWidth={1.5} />
                </button>
             </div>
          </div>

          {/* Search Bar - Full Width Mobile, Center Desktop */}
          <div className="w-full md:flex-1 md:max-w-2xl md:mx-4 lg:mx-12" ref={searchRef}>
            <form onSubmit={handleSearch} className="relative group">
              <div className="relative flex items-center bg-white rounded-md overflow-hidden h-11 md:h-12 transition-all duration-300 focus-within:ring-2 focus-within:ring-red-500/50">
                <div className="pl-3 pr-2 text-red-600">
                  <Bot size={20} className="md:hidden" />
                  <Sparkles size={18} className="hidden md:block" fill="currentColor" />
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search or ask me anything"
                  className="w-full h-full text-gray-800 placeholder-gray-500 bg-transparent outline-none font-normal text-[15px]"
                />
                <button 
                  type="button"
                  onClick={() => setQuery('')}
                  className={`p-2 text-gray-400 md:hover:text-gray-600 active:text-gray-600 ${query ? 'block' : 'hidden'}`}
                >
                  <X size={16} />
                </button>
                <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>
                <button 
                  type="submit" 
                  disabled={isSearching}
                  className="px-4 h-full text-gray-500 md:hover:text-red-600 transition-colors hidden md:block"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {showResults && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                  <div className="p-4">
                    {isSearching ? (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                        <Loader2 className="animate-spin mb-2" size={32} />
                        <p className="text-sm font-medium">Gemini is thinking...</p>
                      </div>
                    ) : results && results.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                          <Sparkles size={16} className="text-red-500" />
                          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">AI Recommendations</h3>
                        </div>
                        <ul className="space-y-3">
                          {results.map((item, idx) => (
                            <li key={idx} className="flex justify-between items-start group cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors">
                              <div>
                                <p className="font-bold text-gray-900 md:group-hover:text-red-600 transition-colors">{item.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.reason}</p>
                              </div>
                              <span className="font-bold text-red-600 whitespace-nowrap ml-4">{item.price}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 pt-3 border-t border-gray-100 text-center">
                          <button className="text-xs font-semibold text-red-600 hover:underline">View all results</button>
                        </div>
                      </div>
                    ) : (
                      // EMPTY / ERROR STATE
                      <div className="flex flex-col items-center justify-center py-6 text-center text-gray-500">
                         <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                            <AlertCircle size={24} className="text-gray-300" />
                         </div>
                         <p className="text-sm font-medium text-gray-900">No results found</p>
                         <p className="text-xs mt-1 max-w-[200px]">We couldn't find a match for "{query}". Try a different term or browse categories.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Desktop Right Icons */}
          <div className="hidden md:flex items-center gap-5 shrink-0 text-white/80">
            <button className="relative hover:text-white transition-colors">
              <Bell size={22} />
            </button>
            <button 
              className="relative group p-3 bg-white/5 md:hover:bg-red-600 active:bg-red-700 text-white rounded-full transition-all duration-300 border border-white/10 shadow-[0_0_15px_rgba(220,38,38,0.3)] md:hover:shadow-red-600/40 md:hover:scale-105 active:scale-95 md:hover:border-transparent"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingCart size={24} className="md:group-hover:text-white" />
              <span className={`absolute -top-1 -right-1 bg-red-600 text-white text-[11px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-[#0F0F0F] shadow-sm transition-all duration-300 ${totalItems > 0 ? 'scale-100' : 'scale-0'} md:group-hover:bg-white md:group-hover:text-red-600 md:group-hover:border-transparent`}>
                {totalItems}
              </span>
            </button>
            <button className="hover:text-white transition-colors">
              <User size={22} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};