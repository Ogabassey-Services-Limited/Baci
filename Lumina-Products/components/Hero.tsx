import React from 'react';
import { ArrowRight } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative bg-[#0F0F0F] text-white overflow-hidden pb-16 pt-10">
      <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent pointer-events-none" />
      
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs font-medium text-red-400">
              <span>New Collection</span>
              <span className="h-1 w-1 rounded-full bg-red-400" />
              <span>Fall 2024</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight">
              Redefine Your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
                Digital Lifestyle
              </span>
            </h1>
            <p className="text-lg text-gray-400 max-w-lg leading-relaxed">
              Discover a curated selection of premium electronics and accessories. 
              Powered by AI to help you find exactly what you need in seconds.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button className="px-8 py-3.5 bg-white text-black font-bold rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2">
                Shop Now <ArrowRight size={18} />
              </button>
              <button className="px-8 py-3.5 border border-white/20 rounded-lg hover:bg-white/10 transition-colors font-semibold">
                View Lookbook
              </button>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-orange-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
            <div className="relative bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/10 aspect-[4/3] flex items-center justify-center">
               <img 
                 src="https://picsum.photos/800/600" 
                 alt="Featured Product" 
                 className="object-cover w-full h-full opacity-90 group-hover:scale-105 transition duration-700 ease-out"
               />
               <div className="absolute bottom-6 left-6 right-6 p-6 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-xl">Lumina X1 Headphones</h3>
                      <p className="text-gray-400 text-sm">Noise cancelling excellence</p>
                    </div>
                    <span className="font-mono text-lg font-bold">$399.00</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};