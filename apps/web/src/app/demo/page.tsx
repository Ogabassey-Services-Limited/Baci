import '@/app/globals.css';
import {
  Bell,
  Gamepad2,
  Keyboard,
  Laptop,
  Printer,
  ShoppingCart,
  Smartphone,
  User,
} from 'lucide-react';
import React from 'react';

const LandingPage = () => {
  // const handleSubmit = (e: React.FormEvent) => {
  //     // Function body for handleSubmit
  // };
  // Demo page — cart is static. When wired to useCart(), replace with live count.
  const cartItemCount: number = 0;
  return (
    <div className="min-h-screen bg-white font-sans">
      {/* --- HEADER SECTION --- */}
      <header className="bg-[#1a1a1a] text-white py-4 px-6 relative overflow-hidden">
        {/* Decorative background pattern (simulated) */}
        <div
          className="absolute inset-0 opacity-5 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="max-w-7xl mx-auto flex items-center justify-between relative z-10 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-1 text-2xl font-bold tracking-tight">
            <span className="text-red-500">oga</span>
            <span>bassey</span>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-500">
                {/* Simulated 'robot' icon from image */}
                <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center text-xs">
                  🤖
                </div>
              </span>
              <input
                type="text"
                placeholder="Search or Ask me anything"
                className="w-full pl-10 pr-4 py-2.5 rounded text-gray-800 focus:outline-hidden focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          {/* Right Icons */}
          <div className="flex items-center gap-6">
            <button
              type="button"
              className="hover:text-red-400 transition"
              aria-label="Notifications"
            >
              <Bell size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="relative hover:text-red-400 transition"
              aria-label={`Shopping Cart, ${cartItemCount} ${cartItemCount === 1 ? 'item' : 'items'}`}
            >
              <ShoppingCart size={20} aria-hidden="true" />
              <span
                aria-hidden="true"
                className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full"
              >
                {cartItemCount}
              </span>
            </button>
            <button
              type="button"
              className="hover:text-red-400 transition"
              aria-label="User Account"
            >
              <User size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* --- HERO SECTION (Bento Grid) --- */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-auto lg:h-[500px]">
          {/* Card 1: iPhone (Spans 2 columns) */}
          <div className="lg:col-span-2 bg-linear-to-br from-red-600 to-red-700 rounded-2xl p-8 relative overflow-hidden text-white flex flex-col justify-center items-center text-center group">
            <div className="relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-2">
                iPhone 16 Pro Max
              </h2>
              <p className="font-handwriting text-2xl italic opacity-90">
                Maximize your{' '}
                <span className="font-bold font-serif">CREATIVITY</span>
              </p>
            </div>
            {/* Placeholder for Product Image */}
            <div className="mt-8 relative w-full h-64 flex justify-center items-end">
              <div className="w-48 h-56 bg-gray-900 rounded-2xl shadow-2xl border-4 border-gray-700 mx-[-20px] transform -rotate-6 transition group-hover:-translate-y-2" />
              <div className="w-48 h-56 bg-gray-300 rounded-2xl shadow-2xl border-4 border-white z-10 transition group-hover:-translate-y-4" />
              <div className="w-48 h-56 bg-yellow-100 rounded-2xl shadow-2xl border-4 border-yellow-500 mx-[-20px] transform rotate-6 transition group-hover:-translate-y-2" />
            </div>
            {/* Carousel Dots */}
            <div className="absolute bottom-4 flex gap-2">
              <div className="w-2 h-2 bg-white rounded-full" />
              <div className="w-2 h-2 bg-white/50 rounded-full" />
              <div className="w-2 h-2 bg-white/50 rounded-full" />
            </div>
          </div>

          {/* Card 2: MacBook (Spans 1 column) */}
          <div className="bg-black text-white rounded-2xl p-6 relative overflow-hidden flex flex-col items-center">
            <div className="text-center z-10 mt-4">
              <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">
                Elevate your workflow
              </p>
              <h2 className="text-3xl font-bold">MacBook Pro</h2>
            </div>
            {/* Big M4 Background Text */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[150px] font-bold text-gray-800 opacity-30 select-none">
              M4
            </div>
            {/* Placeholder Image */}
            <div className="mt-auto w-full h-40 bg-gray-800 rounded-t-lg border-t border-gray-600 shadow-2xl" />
          </div>

          {/* Card 3: PS5 (Spans 1 column) */}
          <div className="bg-purple-800 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col items-center">
            <div className="z-10 text-center mt-4">
              <h2 className="text-4xl font-bold leading-tight">
                PS5 Pro <br /> Edition
              </h2>
              <p className="text-xs uppercase tracking-widest text-purple-200 mt-2 rotate-90 absolute right-[-20px] top-[40%] origin-center whitespace-nowrap">
                Elevate your game
              </p>
            </div>
            {/* Placeholder Image */}
            <div className="mt-auto w-40 h-40 bg-white rounded-3xl shadow-2xl flex items-center justify-center">
              <Gamepad2 size={64} className="text-gray-300" />
            </div>
          </div>
        </div>

        {/* --- CATEGORY NAVIGATION --- */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16">
          <CategoryItem icon={<Smartphone />} label="Phones" />
          <CategoryItem icon={<Gamepad2 />} label="Gaming" />
          <CategoryItem icon={<Keyboard />} label="Accessories" />{' '}
          {/* Fixed typo from image 'Accesories' */}
          <CategoryItem icon={<Printer />} label="Printers" />
          <CategoryItem icon={<Laptop />} label="Laptop" />
        </div>

        {/* --- BOTTOM PROMOS (Partial) --- */}
        <div className="mt-16 flex justify-between items-center px-4">
          <div className="bg-red-100/50 text-gray-800 px-6 py-3 rounded-full font-medium">
            We Pay <span className="text-red-600 font-bold">YOU</span> When
          </div>

          <div className="bg-red-100/50 text-gray-800 px-6 py-3 rounded-full font-medium">
            You Buy <span className="text-red-600 font-bold">Airtime!</span>
          </div>
        </div>
      </main>
    </div>
  );
};

// Helper Component for Categories
const CategoryItem = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <div className="flex flex-col items-center gap-3 group cursor-pointer">
    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-red-500 shadow-sm border border-gray-100 group-hover:bg-red-50 group-hover:border-red-200 transition-all">
      {React.cloneElement(icon as React.ReactElement<{ size: number }>, {
        size: 28,
      })}
    </div>
    <span className="text-sm font-medium text-gray-700">{label}</span>
  </div>
);

export default LandingPage;
