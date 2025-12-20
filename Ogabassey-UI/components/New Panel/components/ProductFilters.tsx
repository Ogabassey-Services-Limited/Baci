import React, { useState, useEffect, useRef } from 'react';
import { SlidersHorizontal, Smartphone, Gamepad2, Laptop, Headphones, Printer, LayoutGrid, LucideIcon, List, Check, Star, Tag, Layers, ChevronDown } from 'lucide-react';

interface ProductFiltersProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  
  // Price Props
  minPrice: number;
  maxPrice: number;
  onPriceChange: (min: number, max: number) => void;
  
  // Brand Props
  brands: string[];
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;

  // Condition Props
  selectedCondition: string;
  onSelectCondition: (condition: string) => void;

  // Rating Props
  minRating: number;
  onSelectRating: (rating: number) => void;

  // View Mode
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

type FilterType = 'price' | 'brand' | 'condition' | 'rating';

export const ProductFilters: React.FC<ProductFiltersProps> = ({
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
  onViewModeChange
}) => {
  const [activeFilterType, setActiveFilterType] = useState<FilterType>('price');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getActiveFilterLabel = () => {
    switch (activeFilterType) {
      case 'price': return 'Price Range';
      case 'brand': return 'Brand';
      case 'condition': return 'Condition';
      case 'rating': return 'Rating';
      default: return 'Filter';
    }
  };

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
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200 border active:scale-95 active:bg-gray-50 ${
                    selectedCategory === category
                      ? 'bg-red-600 text-white border-red-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 md:hover:border-red-200 md:hover:text-red-600'
                  }`}
                >
                  <Icon size={16} />
                  {category}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto border-t lg:border-none pt-3 lg:pt-0">
            
            {/* Dynamic Filter Bar */}
            <div className="flex items-center gap-3 flex-1 lg:flex-none w-full lg:w-auto min-w-0" ref={filterMenuRef}>
                
                {/* Filter Type Toggle */}
                <div className="relative">
                  <button 
                    onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                    className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors active:scale-95"
                  >
                    <SlidersHorizontal size={20} strokeWidth={2} />
                    <span className="text-sm font-bold hidden sm:inline-block">{getActiveFilterLabel()}</span>
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Filter Menu Dropdown */}
                  {isFilterMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="p-1">
                        {[
                          { id: 'price', label: 'Price Range', icon: Tag },
                          { id: 'brand', label: 'Brand', icon: Layers },
                          { id: 'condition', label: 'Condition', icon: Check },
                          { id: 'rating', label: 'Rating', icon: Star },
                        ].map((item) => (
                          <button
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
                            <item.icon size={16} />
                            {item.label}
                            {activeFilterType === item.id && <Check size={14} className="ml-auto" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Vertical Divider */}
                <div className="h-8 w-px bg-gray-200"></div>

                {/* Dynamic Controls */}
                <div className="flex-1 lg:w-64 flex items-center gap-2 animate-in fade-in duration-300 min-w-0">
                  
                  {activeFilterType === 'price' && (
                    <>
                      <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">₦</span>
                          <input
                          type="text"
                          value={minPrice > 0 ? minPrice.toLocaleString() : ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                            onPriceChange(isNaN(val) ? 0 : val, maxPrice);
                          }}
                          placeholder="Min"
                          className="w-full pl-6 pr-2 py-2 text-sm bg-gray-100 border-transparent rounded-lg focus:bg-white focus:border-red-500 focus:ring-0 transition-colors font-medium text-gray-900 placeholder-gray-400"
                          />
                      </div>
                      <span className="text-gray-300">-</span>
                      <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">₦</span>
                          <input
                          type="text"
                          // Hide value if it matches the default ceiling (10,000,000) or is 0
                          value={(maxPrice > 0 && maxPrice < 10000000) ? maxPrice.toLocaleString() : ''}
                          onChange={(e) => {
                             const val = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10);
                             onPriceChange(minPrice, isNaN(val) ? 0 : val);
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
                         {['All', ...brands].map(brand => (
                            <button
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
                       {['All', 'New', 'Open Box', 'Used'].map(condition => (
                          <button
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
                           <button 
                             key={rating}
                             onClick={() => onSelectRating(minRating === rating ? 0 : rating)}
                             className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded transition-colors ${
                               minRating === rating 
                                ? 'bg-amber-100 text-amber-700' 
                                : 'text-gray-500 hover:bg-gray-200'
                             }`}
                           >
                             <span>{rating}+</span>
                             <Star size={10} className="fill-amber-400 text-amber-400" />
                           </button>
                        ))}
                        <button 
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
                <button 
                    onClick={() => onViewModeChange('grid')}
                    className={`p-1.5 rounded-md transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
                    title="Grid View"
                >
                    <LayoutGrid size={18} />
                </button>
                <button 
                    onClick={() => onViewModeChange('list')}
                    className={`p-1.5 rounded-md transition-all active:scale-95 ${viewMode === 'list' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 md:hover:text-gray-600'}`}
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