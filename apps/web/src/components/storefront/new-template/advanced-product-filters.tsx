'use client';

import {
  Check,
  ChevronDown,
  Filter,
  LayoutGrid,
  List,
  Star,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

interface AdvancedProductFiltersProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;

  minPrice: number;
  maxPrice: number;
  onPriceChange: (min: number, max: number) => void;

  brands: string[];
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;

  selectedCondition: string;
  onSelectCondition: (condition: string) => void;

  minRating: number;
  onSelectRating: (rating: number) => void;

  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

type FilterType = 'price' | 'brand' | 'condition' | 'rating' | null;

export const AdvancedProductFilters: React.FC<AdvancedProductFiltersProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  minPrice,
  maxPrice,
  onPriceChange,
  brands,
  selectedBrand,
  onSelectBrand,
  selectedCondition,
  onSelectCondition,
  minRating,
  onSelectRating,
  viewMode,
  onViewModeChange,
}) => {
  const [activeFilterType, setActiveFilterType] = useState<FilterType>(null);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterMenuRef.current &&
        !filterMenuRef.current.contains(event.target as Node)
      ) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <section className="sticky top-20 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all duration-300">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-3">
        <div className="flex flex-col gap-4">
          {/* Top Row: Categories (Horizontal Scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
            {categories.map((category) => (
              <button type="button"
                key={category}
                onClick={() => onSelectCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all active:scale-95 ${
                  selectedCategory === category
                    ? 'bg-gray-900 text-white shadow-md shadow-gray-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Bottom Row: Filter Controls & View Toggle */}
          <div className="flex items-center justify-between gap-4">
            {/* Filter Group */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Main Filter Button (Mobile/Desktop) */}
              <div className="relative" ref={filterMenuRef}>
                <button type="button"
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-colors border ${
                    activeFilterType || isFilterMenuOpen
                      ? 'bg-red-50 text-red-600 border-red-100'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Filter size={16} />
                  <span className="hidden sm:inline">Filters</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isFilterMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                    <div className="p-2 space-y-1">
                      {[
                        { id: 'price', label: 'Price Range', icon: null },
                        { id: 'brand', label: 'Brand', icon: null },
                        { id: 'condition', label: 'Condition', icon: Check },
                        { id: 'rating', label: 'Rating', icon: Star },
                      ].map((item) => (
                        <button type="button"
                          key={item.id}
                          onClick={() => {
                            setActiveFilterType(item.id as FilterType);
                            setIsFilterMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                            activeFilterType === item.id
                              ? 'bg-red-50 text-red-600'
                              : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {item.icon && <item.icon size={16} />}
                          {item.label}
                          {activeFilterType === item.id && (
                            <Check size={14} className="ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Vertical Divider */}
              <div className="h-8 w-px bg-gray-200" />

              {/* Dynamic Controls */}
              <div className="flex-1 lg:w-64 flex items-center gap-2 animate-in fade-in duration-300 min-w-0">
                {activeFilterType === 'price' && (
                  <>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
                        ₦
                      </span>
                      <input
                        type="text"
                        value={minPrice > 0 ? minPrice.toLocaleString() : ''}
                        onChange={(e) => {
                          const val = Number.parseInt(
                            e.target.value.replace(/[^0-9]/g, ''),
                            10
                          );
                          onPriceChange(Number.isNaN(val) ? 0 : val, maxPrice);
                        }}
                        placeholder="Min"
                        className="w-full pl-6 pr-2 py-2 text-sm bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-red-500 focus:ring-0 transition-colors font-medium text-gray-900 placeholder-gray-400"
                      />
                    </div>
                    <span className="text-gray-300">-</span>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
                        ₦
                      </span>
                      <input
                        type="text"
                        // Hide value if it matches the default ceiling (100,000,000) or is 0
                        value={
                          maxPrice > 0 && maxPrice < 100000000
                            ? maxPrice.toLocaleString()
                            : ''
                        }
                        onChange={(e) => {
                          const val = Number.parseInt(
                            e.target.value.replace(/[^0-9]/g, ''),
                            10
                          );
                          onPriceChange(minPrice, Number.isNaN(val) ? 0 : val);
                        }}
                        placeholder="Max"
                        className="w-full pl-6 pr-2 py-2 text-sm bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-red-500 focus:ring-0 transition-colors font-medium text-gray-900 placeholder-gray-400"
                      />
                    </div>
                  </>
                )}

                {activeFilterType === 'brand' && (
                  <div className="relative flex-1 min-w-0">
                    {/* Scroll Container */}
                    <div className="flex overflow-x-auto hide-scrollbar gap-2 pr-0">
                      {['All', ...brands].map((brand) => (
                        <button type="button"
                          key={brand}
                          onClick={() => onSelectBrand(brand)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-colors border flex-shrink-0 ${
                            selectedBrand === brand
                              ? 'bg-gray-900 text-white border-gray-900'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {brand}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeFilterType === 'condition' && (
                  <div className="flex bg-gray-100 p-1 rounded-lg w-full overflow-hidden">
                    {['All', 'New', 'Open Box', 'Used'].map((condition) => (
                      <button type="button"
                        key={condition}
                        onClick={() => onSelectCondition(condition)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap px-1 ${
                          selectedCondition === condition
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                )}

                {activeFilterType === 'rating' && (
                  <div className="flex items-center gap-1 w-full justify-between bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    {[4, 3, 2, 1].map((rating) => (
                      <button type="button"
                        key={rating}
                        onClick={() =>
                          onSelectRating(minRating === rating ? 0 : rating)
                        }
                        className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${
                          minRating === rating
                            ? 'bg-amber-100 text-amber-700'
                            : 'text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        <span>{rating}+</span>
                        <Star
                          size={10}
                          className="fill-amber-400 text-amber-400"
                        />
                      </button>
                    ))}
                    <button type="button"
                      onClick={() => onSelectRating(0)}
                      className={`text-xs font-medium px-2 py-1 rounded text-gray-400 hover:text-gray-600 ${minRating === 0 ? 'text-gray-900 underline decoration-red-500' : ''}`}
                    >
                      Any
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200 ml-auto lg:ml-0 z-20 relative">
              <button type="button"
                onClick={() => onViewModeChange('grid')}
                className={`p-1.5 rounded-md transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
                title="Grid View"
                aria-label="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button type="button"
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-all active:scale-95 ${viewMode === 'list' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
                title="List View"
                aria-label="List View"
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
