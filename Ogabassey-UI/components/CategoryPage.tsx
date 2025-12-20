import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Filter, X, LayoutGrid, List } from 'lucide-react';
import { CategoryFiltersSidebar, FilterState } from './CategoryFiltersSidebar';
import { ProductCard } from './ProductCard';
import { AdUnit } from './AdUnit';
import { BannerCarousel } from './BannerCarousel';
import { products } from '../data/products';
import { useCart } from '../contexts/CartContext';
import { Product } from '../types';

export const CategoryPage: React.FC = () => {
  const { categoryName } = useParams<{ categoryName: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [addedItems, setAddedItems] = useState<number[]>([]);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Initial Filter State
  const initialFilterState: FilterState = {
    brand: [],
    condition: [],
    storage: [],
    ram: [],
    colors: [],
    simType: [],
    displayType: [],
    displaySize: [],
    minPrice: 0,
    maxPrice: 3000000
  };

  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  // Scroll to top when category changes & Reset filters
  useEffect(() => {
    window.scrollTo(0, 0);
    setFilters(initialFilterState);
  }, [categoryName]);

  // Derived Data: Products in the current Category
  const categoryProducts = useMemo(() => {
    return products.filter(p => categoryName === 'All' || p.category === categoryName);
  }, [categoryName]);

  // Derived Data: Available Options based on products in category
  const availableOptions = useMemo(() => {
    const options = {
      brand: new Set<string>(),
      condition: new Set<string>(),
      storage: new Set<string>(),
      ram: new Set<string>(),
      colors: new Set<string>(),
      simType: new Set<string>(),
      displayType: new Set<string>(),
      displaySize: new Set<string>()
    };

    categoryProducts.forEach(p => {
      if (p.brand) options.brand.add(p.brand);
      if (p.condition) options.condition.add(p.condition);
      if (p.storage) options.storage.add(p.storage);
      if (p.ram) options.ram.add(p.ram);
      if (p.colors) p.colors.forEach(c => options.colors.add(c));
      if (p.simType) options.simType.add(p.simType);
      if (p.displayType) options.displayType.add(p.displayType);
      if (p.displaySize) options.displaySize.add(p.displaySize);
    });

    return {
      brand: Array.from(options.brand).sort(),
      condition: Array.from(options.condition).sort(),
      storage: Array.from(options.storage).sort(),
      ram: Array.from(options.ram).sort(),
      colors: Array.from(options.colors).sort(),
      simType: Array.from(options.simType).sort(),
      displayType: Array.from(options.displayType).sort(),
      displaySize: Array.from(options.displaySize).sort()
    };
  }, [categoryProducts]);

  // Derived Data: Filtered Products based on user selection
  const filteredProducts = useMemo(() => {
    return categoryProducts.filter(p => {
      // Price
      if (p.rawPrice < filters.minPrice || p.rawPrice > filters.maxPrice) return false;

      // Checkbox Filters (OR logic within category, AND logic between categories)
      if (filters.brand.length > 0 && (!p.brand || !filters.brand.includes(p.brand))) return false;
      if (filters.condition.length > 0 && (!p.condition || !filters.condition.includes(p.condition))) return false;
      if (filters.storage.length > 0 && (!p.storage || !filters.storage.includes(p.storage))) return false;
      if (filters.ram.length > 0 && (!p.ram || !filters.ram.includes(p.ram))) return false;
      if (filters.simType.length > 0 && (!p.simType || !filters.simType.includes(p.simType))) return false;
      if (filters.displayType.length > 0 && (!p.displayType || !filters.displayType.includes(p.displayType))) return false;
      if (filters.displaySize.length > 0 && (!p.displaySize || !filters.displaySize.includes(p.displaySize))) return false;
      
      // Colors: If product has ANY of the selected colors
      if (filters.colors.length > 0) {
        if (!p.colors || !p.colors.some(c => filters.colors.includes(c))) return false;
      }

      return true;
    });
  }, [categoryProducts, filters]);

  const handleFilterChange = (section: keyof FilterState, value: string | number) => {
    if (section === 'minPrice' || section === 'maxPrice') {
        setFilters(prev => ({ ...prev, [section]: value }));
    } else {
        // Checkbox logic
        setFilters(prev => {
            const list = prev[section] as string[];
            const valStr = value as string;
            if (list.includes(valStr)) {
                return { ...prev, [section]: list.filter(item => item !== valStr) };
            } else {
                return { ...prev, [section]: [...list, valStr] };
            }
        });
    }
  };

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product, 1);
    
    const pid = typeof product.id === 'string' ? parseInt(product.id) : product.id;
    setAddedItems(prev => [...prev, pid]);
    setTimeout(() => {
      setAddedItems(prev => prev.filter(id => id !== pid));
    }, 2000);
  };

  const pageTitle = categoryName === 'All' ? 'All Products' : categoryName;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 pt-4">
      {/* Header Ad replaced with Banner Carousel */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-4">
         <BannerCarousel className="h-40 md:h-52" />
      </div>

      {/* Breadcrumb & Header */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-6">
        <nav className="flex items-center text-sm text-gray-500 overflow-x-auto whitespace-nowrap pb-2">
          <Link to="/" className="hover:text-red-600 transition-colors">Home</Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="text-gray-900 font-medium">{pageTitle}</span>
        </nav>
        
        <div className="mt-4 flex items-end justify-between">
           <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900">{pageTitle}</h1>
                <p className="text-gray-500 text-sm mt-1">
                    {filteredProducts.length} results found
                </p>
           </div>
           
           {/* View Mode & Mobile Filter Toggle */}
           <div className="flex items-center gap-2">
                <div className="hidden md:flex items-center bg-white rounded-lg p-1 border border-gray-200">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <LayoutGrid size={18} />
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-gray-100 text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <List size={18} />
                    </button>
                </div>

                <button 
                    onClick={() => setIsMobileFilterOpen(true)}
                    className="md:hidden flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md active:scale-95"
                >
                    <Filter size={16} /> Filters
                </button>
           </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
         <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar Filters (Desktop) */}
            <div className="hidden lg:block lg:col-span-1">
                <div className="sticky top-24">
                    <CategoryFiltersSidebar 
                        filters={filters}
                        availableOptions={availableOptions}
                        onFilterChange={handleFilterChange}
                        onClearFilters={() => setFilters(initialFilterState)}
                    />
                    <div className="mt-6">
                        <AdUnit placementKey="PRODUCT_SIDEBAR" />
                    </div>
                </div>
            </div>

            {/* Product Grid */}
            <div className="lg:col-span-3">
                {filteredProducts.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Filter className="text-gray-400" size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">No products found</h3>
                        <p className="text-gray-500 text-sm mb-6">Try adjusting your filters to find what you're looking for.</p>
                        <button 
                            onClick={() => setFilters(initialFilterState)}
                            className="text-red-600 font-bold hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' 
                        ? "grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6" 
                        : "flex flex-col gap-4"
                    }>
                        {filteredProducts.map((product, index) => {
                            const isAdded = addedItems.includes(typeof product.id === 'string' ? parseInt(product.id) : product.id);
                            return (
                                <React.Fragment key={product.id}>
                                    <ProductCard 
                                        product={product} 
                                        onAddToCart={handleAddToCart} 
                                        isAdded={isAdded}
                                        viewMode={viewMode}
                                    />
                                    {/* Ad insertion logic */}
                                    {viewMode === 'grid' && (index === 5 || index === 11) && (
                                        <div className="col-span-2 md:col-span-3 my-4">
                                            <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
                                        </div>
                                    )}
                                     {viewMode === 'list' && (index === 3 || index === 7) && (
                                        <div className="w-full my-4">
                                            <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                )}
            </div>
         </div>
      </div>

      {/* Mobile Filter Drawer */}
      {isMobileFilterOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileFilterOpen(false)}></div>
            <div className="relative w-full max-w-xs bg-white h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
                <div className="sticky top-0 bg-white z-10 px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-bold text-lg text-gray-900">Filters</h3>
                    <button onClick={() => setIsMobileFilterOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>
                <div className="p-5 pb-24">
                     <CategoryFiltersSidebar 
                        filters={filters}
                        availableOptions={availableOptions}
                        onFilterChange={handleFilterChange}
                        onClearFilters={() => setFilters(initialFilterState)}
                        className="border-none shadow-none p-0"
                    />
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
                     <button 
                        onClick={() => setIsMobileFilterOpen(false)}
                        className="w-full bg-red-600 text-white font-bold py-3 rounded-xl shadow-lg active:scale-95"
                     >
                        Show {filteredProducts.length} Results
                     </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};