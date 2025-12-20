
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, User, Heart, Wallet, ShoppingBag, HelpCircle, Star, Crown, FileText, MapPin, Wrench, RefreshCw, Palette, Snowflake, ScanBarcode } from 'lucide-react';
import { Logo } from './Logo';
import { useTheme } from '../contexts/ThemeContext';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    navigate(path);
    onClose();
  };

  const menuItems = [
     { label: 'Profile', icon: User, path: '/profile' },
     { label: 'Member Status', icon: Crown, path: '/member-status' },
     { label: 'Orders', icon: ShoppingBag, path: '/orders' }, 
     { label: 'Saved Items', icon: Heart, path: '/saved' },
     { label: 'IMEI Checker', icon: ScanBarcode, path: '/imei-check' },
     { label: 'Wallet', icon: Wallet, path: '/wallet' },
     { label: 'Receipts', icon: FileText, path: '/receipts' },
     { label: 'Address Book', icon: MapPin, path: '/addresses' },
     { label: 'Repairs', icon: Wrench, path: '/repairs' },
     { label: 'Swap / Trade-in', icon: RefreshCw, path: '/swap' },
     { label: 'My Reviews', icon: Star, path: '/reviews' },
     { label: 'Help & Support', icon: HelpCircle, path: '/help' },
  ];

  return (
    <div className="fixed inset-0 z-[100]">
       {/* Backdrop */}
       <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}></div>
       
       {/* Sidebar */}
       <div className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-white shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
             <Logo className="h-6 w-auto text-gray-900" />
             <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
               <X size={20} />
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-4 hide-scrollbar">
             {/* Account & Help */}
             <div className="px-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Account</h3>
                <div className="space-y-1">
                   {menuItems.map((item) => {
                      const isActive = location.pathname === item.path;
                      return (
                      <button 
                        key={item.label}
                        onClick={() => handleNavigate(item.path)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-sm group ${isActive ? 'bg-red-50 text-red-600 font-bold' : 'hover:bg-gray-50 text-gray-700 font-medium'}`}
                      >
                         <div className="flex items-center gap-3">
                            <item.icon size={18} className={isActive ? "text-red-600" : "text-gray-400 group-hover:text-red-600"} />
                            {item.label}
                         </div>
                      </button>
                   )})}
                </div>

                {/* Theme Toggle Section */}
                <div className="mt-6 pt-6 border-t border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Appearance</h3>
                    <button 
                        onClick={toggleTheme}
                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-sm border ${theme === 'santa' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            {theme === 'santa' ? <Snowflake size={18} className="text-red-600" /> : <Palette size={18} className="text-gray-400" />}
                            <span className="font-medium">{theme === 'santa' ? 'Festive Mode On' : 'Standard Theme'}</span>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'santa' ? 'bg-red-600' : 'bg-gray-300'}`}>
                            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${theme === 'santa' ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </div>
                    </button>
                </div>
             </div>
          </div>
          
          {/* Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50">
             <button className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-transform">
                Login / Register
             </button>
             <p className="text-center text-[10px] text-gray-400 mt-3">v1.0.0 • © 2024 Ogabassey</p>
          </div>
       </div>
    </div>
  );
};
