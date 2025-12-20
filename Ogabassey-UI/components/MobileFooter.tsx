
import React, { useState, useEffect } from 'react';
import { Home, Heart, ShoppingCart, Wallet, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';

export const MobileFooter: React.FC = () => {
  const { totalItems } = useCart();
  const location = useLocation();
  
  // Improved active state logic to handle sub-pages
  const isActive = (path: string) => {
      if (path === '/profile') {
          // Profile is active for profile + subpages not explicitly covered by other icons
          return ['/profile', '/orders', '/receipts', '/addresses', '/member-status', '/reviews', '/repairs', '/swap', '/notifications', '/security', '/help'].includes(location.pathname);
      }
      return location.pathname === path;
  };

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

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#0F0F0F] border-t border-white/5 px-6 py-4 md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.3)] transition-transform duration-200 ease-out will-change-transform overflow-hidden ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
    >
      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
            style={{ 
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3C!-- Original items --%3E%3Cg transform='translate(20, 20) rotate(-15 6 10)'%3E%3Crect x='0' y='0' width='12' height='20' rx='2'/%3E%3Cline x1='4' y1='17' x2='8' y2='17' stroke-width='1'/%3E%3C/g%3E%3Cg transform='translate(90, 15) rotate(10 10 7)'%3E%3Cpath d='M2 0 h16 v10 h-16 z M0 10 h20 v2 h-20 z'/%3E%3C/g%3E%3Cg transform='translate(25, 80) rotate(20 8 8)'%3E%3Cpath d='M0 10 v5 h4 v-5 a6 6 0 1 1 12 0 v5 h4 v-5'/%3E%3C/g%3E%3Cg transform='translate(75, 100) rotate(-10 6 6)'%3E%3Crect x='0' y='0' width='12' height='12' rx='3'/%3E%3Cpath d='M3 -3 v3 M9 -3 v3 M3 12 v3 M9 12 v3'/%3E%3C/g%3E%3Cg transform='translate(120, 90) rotate(5 9 6)'%3E%3Crect x='0' y='3' width='18' height='12' rx='2'/%3E%3Ccircle cx='9' cy='9' r='3'/%3E%3Crect x='2' y='0' width='4' height='3' rx='1'/%3E%3C/g%3E%3Cg transform='translate(70, 50) rotate(-25 10 6)'%3E%3Crect x='0' y='0' width='20' height='12' rx='6'/%3E%3Ccircle cx='6' cy='6' r='2'/%3E%3Ccircle cx='14' cy='6' r='2'/%3E%3C/g%3E%3Cg transform='translate(120, 40) rotate(35 8 10)'%3E%3Crect x='0' y='0' width='16' height='20' rx='2'/%3E%3C/g%3E%3C!-- New items for density --%3E%3Cg transform='translate(50, 15) rotate(45 5 5)'%3E%3Crect x='2' y='-2' width='6' height='14' rx='1'/%3E%3Crect x='0' y='2' width='10' height='6' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 55) rotate(15 5 8)'%3E%3Crect x='0' y='0' width='10' height='16' rx='5'/%3E%3Cline x1='5' y1='0' x2='5' y2='6'/%3E%3C/g%3E%3Cg transform='translate(45, 115) rotate(-10 6 8)'%3E%3Crect x='0' y='0' width='12' height='16' rx='1'/%3E%3Ccircle cx='6' cy='4' r='2'/%3E%3Ccircle cx='6' cy='11' r='3'/%3E%3C/g%3E%3Cg transform='translate(100, 75) rotate(30 6 6)'%3E%3Crect x='0' y='4' width='12' height='8' rx='2'/%3E%3Cpath d='M2 4 v-4 M10 4 v-4'/%3E%3C/g%3E%3Cg transform='translate(135, 125) rotate(-45 5 9)'%3E%3Crect x='0' y='0' width='10' height='18' rx='2'/%3E%3C/g%3E%3Cg transform='translate(10, 120) rotate(0)'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C!-- Fillers --%3E%3Ccircle cx='60' cy='60' r='1.5' fill='%23ffffff'/%3E%3Cpath d='M90 130 l4 4 m-4 0 l4 -4' stroke-width='1'/%3E%3Ccircle cx='140' cy='20' r='2' stroke='none' fill='%23ffffff'/%3E%3Cpath d='M30 5 l3 3 m-3 0 l3 -3' stroke-width='1'/%3E%3Ccircle cx='80' cy='30' r='1'/%3E%3Ccircle cx='110' cy='110' r='1.5'/%3E%3C/g%3E%3C/svg%3E")`,
              backgroundSize: '140px 140px'
            }}>
      </div>

      <div className="flex items-center justify-between px-4 relative z-10">
        
        {/* Home */}
        <Link to="/" className="flex flex-col items-center justify-center active:scale-90 transition-transform">
          <div className={`p-2 transition-all duration-300 ${isActive('/') ? 'text-white' : 'text-gray-400'}`}>
             <Home size={26} strokeWidth={isActive('/') ? 2.5 : 2} fill={isActive('/') ? "currentColor" : "none"} />
          </div>
        </Link>

        {/* Saved */}
        <Link to="/saved" className="flex flex-col items-center justify-center active:scale-90 transition-transform">
          <div className={`p-2 transition-colors ${isActive('/saved') ? 'text-white' : 'text-gray-400'}`}>
            <Heart size={26} fill={isActive('/saved') ? "currentColor" : "none"} strokeWidth={isActive('/saved') ? 2.5 : 2} />
          </div>
        </Link>

        {/* Cart */}
        <Link 
          to="/cart"
          className="flex flex-col items-center justify-center relative active:scale-90 transition-transform">
          <div className={`p-2 transition-colors ${isActive('/cart') ? 'text-white' : 'text-gray-400'}`}>
            <ShoppingCart size={26} fill={isActive('/cart') ? "currentColor" : "none"} strokeWidth={isActive('/cart') ? 2.5 : 2} />
            {totalItems > 0 && (
              <span className="absolute top-1 -right-1 bg-red-600 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border-2 border-[#0F0F0F]">
                {totalItems}
              </span>
            )}
          </div>
        </Link>

        {/* Wallet */}
        <Link to="/wallet" className="flex flex-col items-center justify-center active:scale-90 transition-transform">
          <div className={`p-2 transition-colors ${isActive('/wallet') ? 'text-white' : 'text-gray-400'}`}>
            <Wallet size={26} fill={isActive('/wallet') ? "currentColor" : "none"} strokeWidth={isActive('/wallet') ? 2.5 : 2} />
          </div>
        </Link>

        {/* Profile */}
        <Link to="/profile" className="flex flex-col items-center justify-center active:scale-90 transition-transform">
          <div className={`p-2 transition-colors ${isActive('/profile') ? 'text-white' : 'text-gray-400'}`}>
            <User size={26} fill={isActive('/profile') ? "currentColor" : "none"} strokeWidth={isActive('/profile') ? 2.5 : 2} />
          </div>
        </Link>

      </div>
    </div>
  );
};
