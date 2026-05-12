'use client';
// Template preview

import {
  Crown,
  FileText,
  Heart,
  HelpCircle,
  MapPin,
  RefreshCw,
  ShoppingBag,
  Star,
  User,
  X,
} from 'lucide-react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import type React from 'react';
import { useMerchant } from '@/hooks/merchant/use-merchant';

import { Logo } from './logo';

// import { useTheme } from '../contexts/ThemeContext'; // Removed



interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  logo?: string;
}

// Revert Component Definition
export const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  logo,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  const { basePath } = useMerchant();

  if (!isOpen) return null;

  const handleNavigate = (path: string) => {
    const fullPath = `${basePath}${path}`;
    router.push(fullPath as Route);
    onClose();
  };

  const menuItems = [
    { label: 'Profile', icon: User, path: '/account' },
    { label: 'Member Status', icon: Crown, path: '/member-status' },
    { label: 'Orders', icon: ShoppingBag, path: '/account/orders' },
    { label: 'Saved Items', icon: Heart, path: '/wishlist' },
    { label: 'Receipts', icon: FileText, path: '/receipts' },
    { label: 'Address Book', icon: MapPin, path: '/account/addresses' },
    { label: 'Swap / Trade-in', icon: RefreshCw, path: '/swap' },
    { label: 'My Reviews', icon: Star, path: '/reviews' },
    { label: 'Help & Support', icon: HelpCircle, path: '/pages/faq' },
  ];



  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-white shadow-2xl animate-in slide-in-from-left duration-300 flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <Logo className="h-8 w-auto" color="black" />
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 hide-scrollbar">
          {/* Account & Help */}
          <div className="px-5">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
              Account
            </h3>
            <div className="space-y-1">
              {menuItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.label}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors text-sm group ${isActive ? 'bg-red-50 text-red-600 font-bold' : 'hover:bg-gray-50 text-gray-700 font-medium'}`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon
                        size={18}
                        className={
                          isActive
                            ? 'text-red-600'
                            : 'text-gray-400 group-hover:text-red-600'
                        }
                      />
                      {item.label}
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 md:hidden">
          <button
            onClick={() => handleNavigate('/account/login')}
            className="w-full bg-gray-900 text-white font-bold py-3.5 rounded-xl shadow-lg active:scale-95 transition-transform"
          >
            Login / Register
          </button>
          <p className="text-center text-[10px] text-gray-400 mt-3">
            v1.0.0 • © 2024 Ogabassey
          </p>
        </div>
      </div>
    </div>
  );
};

// Fix Export Alias
export { MobileMenu as OgabasseyMobileMenu };
