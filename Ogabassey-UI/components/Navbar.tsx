import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Bell, BellOff, User, X, LayoutGrid, Menu, ArrowRight, ChevronDown, Smartphone, Laptop, Gamepad2, Headphones, Printer, ScanBarcode, Wrench, Wallet, Package, Shield, Check, Gift } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useNotification } from '../contexts/NotificationContext';
import { Logo } from './Logo';
import { products } from '../data/products';
import { Product } from '../types';
import { SourceRequestModal } from './SourceRequestModal';
import { MobileMenu } from './MobileMenu';

export const Navbar: React.FC = () => {
  const { totalItems } = useCart();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotification();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Notification UI State
  const [showNotifications, setShowNotifications] = useState(false);

  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  
  const navigate = useNavigate();
  
  // Scroll visibility logic
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 10) {
        if (isVisible) setIsVisible(false);
        setShowDropdown(false);
        setShowCategoryDropdown(false);
        setShowNotifications(false);
      } else if (currentScrollY < lastScrollY) {
        if (!isVisible) setIsVisible(true);
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
        const results = products.filter(p => 
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
    if (!query.trim()) return;
    setShowDropdown(false);
  };

  const openSourceModal = () => {
      setShowDropdown(false);
      setIsSourceModalOpen(true);
  };

  const NAV_CATEGORIES = [
    { name: 'Phones', icon: Smartphone },
    { name: 'Laptops', icon: Laptop },
    { name: 'Gaming', icon: Gamepad2 },
    { name: 'Accessories', icon: Headphones },
    { name: 'Printers', icon: Printer },
  ];

  return (
    <>
    <header 
      className={`sticky top-0 z-50 shadow-md transition-transform duration-200 ease-out will-change-transform ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}
    >
      {/* --- TOP HEADER ROW (BLACK) --- */}
      <div className="bg-[#0F0F0F] relative z-20 text-white border-b border-white/5">
        {/* Dark Pattern Background Container */}
        <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden" 
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23ffffff'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '140px 140px'
              }}>
        </div>

        <div className="max-w-[1400px] mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6">
            
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

                  <Link to="/" className="flex items-center cursor-pointer select-none active:opacity-80 transition-opacity text-white">
                    <Logo className="h-5 md:h-8 w-auto text-white" />
                  </Link>
              </div>
            </div>

            {/* Search Bar - Full Width Mobile, Center Desktop */}
            <div className="w-full md:flex-1 md:max-w-2xl md:mx-auto relative" ref={searchRef}>
              <form onSubmit={handleSearch} className="relative group">
                <div className="relative flex items-center bg-white rounded-md overflow-hidden h-11 md:h-12 transition-all duration-300 focus-within:shadow-[0_0_0_2px_#fff,0_0_0_5px_rgba(220,38,38,0.5),0_0_20px_rgba(220,38,38,0.3)] focus-within:scale-[1.01]">
                  
                  {/* Input */}
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => { if(query.trim()) setShowDropdown(true) }}
                    placeholder="Search products, brands and categories"
                    className="w-full h-full text-gray-800 placeholder-gray-500 bg-transparent outline-none font-normal text-[15px] pl-4"
                    autoComplete="off"
                  />

                  {/* Clear Button */}
                  <button 
                    type="button"
                    onClick={() => { setQuery(''); setShowDropdown(false); }}
                    className={`p-2 text-gray-400 hover:text-gray-600 ${query ? 'block' : 'hidden'}`}
                  >
                    <X size={16} />
                  </button>

                  {/* Divider */}
                  <div className="h-6 w-px bg-gray-200 mx-1"></div>

                  {/* Submit/Search Button (Icon on Right) */}
                  <button 
                    type="submit" 
                    className="px-4 h-full text-red-600 hover:text-red-700 transition-colors active:scale-95 flex items-center justify-center"
                  >
                    <Search size={20} />
                  </button>
                </div>
              </form>
            </div>

            {/* Desktop Right Icons */}
            <div className="hidden md:flex items-center gap-5 shrink-0 text-white/80">
              
              {/* Notification Icon & Dropdown */}
              <div className="relative" ref={notificationRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`relative hover:text-white transition-colors ${showNotifications ? 'text-white' : ''}`}
                  >
                    <Bell size={22} />
                    {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-[#1a1a1a]"></span>
                    )}
                  </button>

                  {/* Notifications Dropdown */}
                  {showNotifications && (
                      <div className="absolute top-full right-0 mt-4 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-0 animate-in fade-in slide-in-from-top-2 z-50 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                              <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
                              {unreadCount > 0 && (
                                  <button onClick={markAllAsRead} className="text-[10px] font-bold text-red-600 hover:underline">
                                      Mark all read
                                  </button>
                              )}
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                              {unreadCount === 0 ? (
                                  <div className="p-8 text-center text-gray-500 flex flex-col items-center">
                                      <BellOff size={24} className="mb-2 opacity-50" />
                                      <p className="text-xs font-medium">No recent notifications</p>
                                  </div>
                              ) : (
                                  notifications.filter(n => !n.read).map(n => (
                                      <div key={n.id} className="px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 relative group">
                                          <div className="flex gap-3">
                                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${n.type === 'order' ? 'bg-blue-50 text-blue-600' : n.type === 'promo' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                                                  {n.type === 'order' ? <Package size={14} /> : n.type === 'promo' ? <Gift size={14} /> : <Shield size={14} />}
                                              </div>
                                              <div className="flex-1">
                                                  <h4 className="text-xs font-bold text-gray-900 mb-0.5">{n.title}</h4>
                                                  <p className="text-[11px] text-gray-500 leading-tight mb-1">{n.message}</p>
                                                  <span className="text-[10px] text-gray-400">{n.time}</span>
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
                                to="/notifications" 
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
                to="/cart"
                className="relative hover:text-white transition-colors"
              >
                <ShoppingCart size={22} />
                <span className={`absolute -top-1.5 -right-1.5 bg-red-600 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-[#1a1a1a] transition-all ${totalItems > 0 ? 'scale-100' : 'scale-0'}`}>
                  {totalItems}
                </span>
              </Link>
              <Link to="/profile" className="hover:text-white transition-colors">
                <User size={22} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* --- SECONDARY NAVIGATION ROW (WHITE) --- */}
      <div className="bg-white border-b border-gray-200 relative z-10 hidden md:block">
        {/* Light Pattern Background */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden" 
              style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23000000' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23000000'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23000000'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
                backgroundSize: '140px 140px'
              }}>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10">
            <div className="flex items-center gap-6 h-12">
                {/* Shop by Category Collapsible */}
                <div className="relative" ref={categoryRef}>
                    <button 
                        onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                        className={`flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1 ${showCategoryDropdown ? 'text-red-600' : ''}`}
                    >
                        <LayoutGrid size={18} />
                        Shop by Category
                        <ChevronDown size={14} className={`transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {showCategoryDropdown && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                            <div className="absolute -top-1.5 left-8 w-3 h-3 bg-white rotate-45 border-l border-t border-gray-100"></div>
                            {NAV_CATEGORIES.map((cat) => (
                                <Link 
                                    key={cat.name} 
                                    to={`/category/${cat.name}`}
                                    onClick={() => setShowCategoryDropdown(false)}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 hover:text-red-600 transition-colors group"
                                >
                                    <cat.icon size={18} className="text-gray-400 group-hover:text-red-600 transition-colors" />
                                    <span className="font-medium text-gray-700 group-hover:text-red-900">{cat.name}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="h-4 w-px bg-gray-200"></div>

                {/* IMEI Checker */}
                <Link to="/imei-check" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1">
                    <ScanBarcode size={18} />
                    IMEI Checker
                </Link>

                <div className="h-4 w-px bg-gray-200"></div>

                {/* Repairs */}
                <Link to="/repairs" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1">
                    <Wrench size={18} />
                    Repairs
                </Link>

                <div className="h-4 w-px bg-gray-200"></div>

                {/* Wallet */}
                <Link to="/wallet" className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-red-600 transition-colors px-1 py-1">
                    <Wallet size={18} />
                    Wallet
                </Link>
            </div>
        </div>
      </div>

      {/* FULL WIDTH DROPDOWN */}
      {showDropdown && query && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 w-full bg-white border-b border-gray-100 z-50 animate-in fade-in slide-in-from-top-1 duration-200 shadow-none pb-2"
        >
            <div className="max-w-[1400px] mx-auto px-4 md:px-6">
              {searchResults.length > 0 ? (
                 <div className="py-2">
                     <div className="py-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex justify-between items-center border-b border-gray-50 mb-2">
                        <span>Products</span>
                        <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{searchResults.length} found</span>
                     </div>
                     <div className="max-h-[60vh] overflow-y-auto">
                       {searchResults.map(product => (
                           <Link 
                              key={product.id} 
                              to={`/product/${product.id}`}
                              onClick={() => { setShowDropdown(false); setQuery(''); }}
                              className="flex items-center gap-3 px-2 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 rounded-lg group"
                           >
                               <div className="w-10 h-10 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center p-1 border border-gray-100 group-hover:border-gray-200 transition-colors">
                                  <img src={product.image} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" />
                               </div>
                               <div className="min-w-0 flex-1">
                                   <div className="font-bold text-gray-900 text-sm truncate group-hover:text-red-600 transition-colors">{product.name}</div>
                                   <div className="text-red-600 text-xs font-bold">{product.price}</div>
                               </div>
                               <div className="text-gray-300 group-hover:text-red-600 transition-colors">
                                  <ArrowRight size={16} />
                               </div>
                           </Link>
                       ))}
                     </div>
                 </div>
             ) : (
                 <div className="p-6 text-center">
                     <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Search className="w-6 h-6 text-gray-400" />
                     </div>
                     <p className="text-gray-900 font-bold mb-1">No results for "{query}"</p>
                     <p className="text-gray-500 text-xs mb-5 max-w-[240px] mx-auto">We couldn't find what you're looking for in our inventory.</p>
                     
                     <button 
                        onClick={openSourceModal}
                        className="w-full max-w-sm mx-auto bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl text-sm transition-all shadow-lg hover:shadow-red-200 active:scale-[0.98] flex items-center justify-center gap-2"
                     >
                        Source it for me
                        <ArrowRight size={16} />
                     </button>
                 </div>
             )}
            </div>
        </div>
      )}
    </header>

    <SourceRequestModal 
        isOpen={isSourceModalOpen} 
        onClose={() => setIsSourceModalOpen(false)} 
        initialQuery={query}
    />
    
    <MobileMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
};