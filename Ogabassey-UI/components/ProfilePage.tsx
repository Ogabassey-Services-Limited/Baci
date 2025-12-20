
import React from 'react';
import { User, Package, Heart, Wallet, MapPin, Settings, LogOut, HelpCircle, ChevronRight, Bell, Shield, Palette, Sparkles, Snowflake, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

export const ProfilePage: React.FC = () => {
  const { theme, setTheme } = useTheme();

  // Mock User Data
  const user = {
    name: "Alex Doe",
    email: "alex.doe@example.com",
    phone: "+234 800 123 4567",
    joinDate: "Member since 2023",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  };

  const menuItems = [
    { icon: Package, label: 'My Orders', desc: 'Track, return, or buy again', link: '/orders' },
    { icon: History, label: 'Purchase History', desc: 'Browse past items', link: '/purchase-history' },
    { icon: Heart, label: 'Saved Items', desc: 'Your wishlist', link: '/saved' },
    { icon: Wallet, label: 'My Wallet', desc: 'Manage balance & cards', link: '/wallet' },
    { icon: MapPin, label: 'Addresses', desc: 'Edit delivery locations', link: '/addresses' },
    { icon: Bell, label: 'Notifications', desc: 'Offers & order updates', link: '/notifications' },
    { icon: Shield, label: 'Security', desc: 'Password & 2FA', link: '/security' },
    { icon: HelpCircle, label: 'Help & Support', desc: 'FAQs & customer care', link: '/help' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1 flex flex-col">
        
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2 shrink-0">
          <User className="text-red-600 fill-red-600" />
          My Profile
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Profile Card */}
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-r from-gray-900 to-gray-800"></div>
                    
                    <div className="relative w-24 h-24 rounded-full border-4 border-white shadow-md mb-4 mt-8">
                        <img src={user.avatar} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        <button className="absolute bottom-0 right-0 bg-red-600 text-white p-1.5 rounded-full border-2 border-white hover:bg-red-700 transition-colors">
                            <Settings size={14} />
                        </button>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
                    <p className="text-gray-500 text-sm mb-1">{user.email}</p>
                    <p className="text-gray-400 text-xs mb-6">{user.phone}</p>
                    
                    <div className="w-full grid grid-cols-2 gap-4 border-t border-gray-100 pt-6">
                        <div className="text-center">
                            <span className="block text-lg font-bold text-gray-900">12</span>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Orders</span>
                        </div>
                        <div className="text-center border-l border-gray-100">
                            <span className="block text-lg font-bold text-gray-900">5</span>
                            <span className="text-xs text-gray-500 uppercase tracking-wide">Saved</span>
                        </div>
                    </div>
                </div>

                {/* THEME SELECTOR SECTION */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                        <Palette size={18} className="text-red-600" />
                        <h3 className="font-bold text-gray-900">App Themes</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => setTheme('standard')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === 'standard' ? 'border-red-600 bg-red-50 ring-1 ring-red-100' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className="w-8 h-8 rounded-full bg-gray-900 flex items-center justify-center text-white">
                                <Sparkles size={16} />
                            </div>
                            <span className={`text-xs font-bold ${theme === 'standard' ? 'text-red-600' : 'text-gray-600'}`}>Standard</span>
                        </button>

                        <button 
                            onClick={() => setTheme('santa')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${theme === 'santa' ? 'border-red-600 bg-red-50 ring-1 ring-red-100' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white">
                                <Snowflake size={16} />
                            </div>
                            <span className={`text-xs font-bold ${theme === 'santa' ? 'text-red-600' : 'text-gray-600'}`}>Santa</span>
                        </button>
                    </div>
                </div>

                <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                    <h3 className="font-bold text-red-900 mb-2">Ogabassey Premium</h3>
                    <p className="text-sm text-red-700 mb-4">Unlock free delivery and exclusive deals.</p>
                    <button className="w-full bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm hover:bg-red-700 transition-colors shadow-sm active:scale-95">
                        Upgrade Now
                    </button>
                </div>
            </div>

            {/* Right Column: Menu */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {menuItems.map((item, index) => (
                        <Link 
                            key={index} 
                            to={item.link}
                            className="flex items-center justify-between p-4 md:p-6 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group active:bg-gray-100"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-red-50 group-hover:text-red-600 transition-colors">
                                    <item.icon size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm md:text-base">{item.label}</h4>
                                    <p className="text-xs text-gray-500">{item.desc}</p>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-gray-300 group-hover:text-red-600 transition-colors" />
                        </Link>
                    ))}

                    <button className="w-full flex items-center justify-between p-4 md:p-6 hover:bg-red-50 transition-colors group text-left active:bg-red-100">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                                <LogOut size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-red-600 text-sm md:text-base">Log Out</h4>
                                <p className="text-xs text-red-400">Securely sign out of your account</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};
