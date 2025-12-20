import React, { useState } from 'react';
import { SlidersHorizontal, Smartphone, Gamepad2, Laptop, Headphones, Printer, LayoutGrid, LucideIcon, List, Grid, X } from 'lucide-react';

interface ProductFiltersProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  minPrice: number;
  maxPrice: number;
  onPriceChange: (min: number, max: number) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'All': LayoutGrid,
  'Phones': Smartphone,
  'Gaming': Gamepad2,
  'Laptops': Laptop,
  'Accessories': Headphones,
  'Printers': Printer
};

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  minPrice,
  maxPrice,
  onPriceChange,
  viewMode,
  onViewModeChange
}) => {
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const isFilterActive = minPrice > 0 || maxPrice < 3000000;

  return (
    <section className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm transition-all duration-300">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Category Filter */}
          <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto hide-scrollbar pb-2 lg:pb-0">
            {categories.map((category) => {
              const Icon = CATEGORY_ICONS[category] || LayoutGrid;
              return (
                <button
                  key={category}
                  onClick={() => onSelectCategory(category)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border active:scale-95 ${
                    selectedCategory === category
                      ? 'bg-red-600 text-white border-red-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 md:hover:border-red-200 md:hover:text-red-600 active:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  {category}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto border-t lg:border-none pt-3 lg:pt-0">
            {/* Price Filter Toggle & Inputs */}
            <div className="flex items-center gap-2 flex-1 lg:flex-none">
                <button 
                    onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                    className={`h-10 px-3 rounded-xl border transition-all duration-200 flex items-center gap-2 shadow-sm ${
                        isFilterExpanded || isFilterActive
                        ? 'bg-red-700 border-red-700 text-white' 
                        : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                    }`}
                    title="Toggle Price Filter"
                >
                    <SlidersHorizontal size={18} strokeWidth={2} />
                    <span className="text-xs font-bold hidden sm:block">Filter</span>
                    {isFilterActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse ml-0.5"></span>
                    )}
                </button>
                
                {/* Expandable Inputs */}
                <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-in-out ${
                    isFilterExpanded ? 'w-auto opacity-100 translate-x-0' : 'w-0 opacity-0 -translate-x-2 pointer-events-none'
                }`}>
                    <div className="relative w-24 sm:w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">₦</span>
                        <input
                        type="number"
                        value={minPrice || ''}
                        onChange={(e) => onPriceChange(Number(e.target.value), maxPrice)}
                        placeholder="Min"
                        className="w-full pl-6 pr-2 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-100 rounded-lg focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-medium text-gray-900 outline-none h-10"
                        />
                    </div>
                    <span className="text-gray-300 font-medium">-</span>
                    <div className="relative w-24 sm:w-28">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">₦</span>
                        <input
                        type="number"
                        value={maxPrice || ''}
                        onChange={(e) => onPriceChange(minPrice, Number(e.target.value))}
                        placeholder="Max"
                        className="w-full pl-6 pr-2 py-2.5 text-xs sm:text-sm bg-gray-50 border border-gray-100 rounded-lg focus:bg-white focus:border-red-500 focus:ring-2 focus:ring-red-100 transition-all font-medium text-gray-900 outline-none h-10"
                        />
                    </div>

                    {isFilterActive && (
                        <button 
                            onClick={() => onPriceChange(0, 3000000)}
                            className="h-10 w-10 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                            title="Reset Price"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 ml-auto lg:ml-0 h-10">
                <button 
                    onClick={() => onViewModeChange('grid')}
                    className={`h-full px-2.5 rounded-md transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
                    title="Grid View"
                >
                    <LayoutGrid size={18} />
                </button>
                <button 
                    onClick={() => onViewModeChange('list')}
                    className={`h-full px-2.5 rounded-md transition-all active:scale-95 ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
                    title="List View"
                >
                    <List size={18} />
                </button>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};