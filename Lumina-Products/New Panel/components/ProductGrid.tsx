import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../data/products';
import { useCart } from '../contexts/CartContext';
import { AdUnit } from './AdUnit';
import { ProductGridItem } from './final-grid/ProductGridItem';
import { ProductListItem } from './ProductListItem';
import { ProductFilters } from './ProductFilters';
import { Product } from '../types';

interface ProductGridProps {
  selectedCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  title?: string;
  showViewAll?: boolean;
  onProductAdded?: (product: Product, rect?: DOMRect) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ 
  selectedCategory: defaultCategory = 'All', 
  minPrice: defaultMin = 0, 
  maxPrice: defaultMax = 100000000,
  title = "Featured Products",
  showViewAll = true,
  onProductAdded
}) => {
  const { addToCart, setIsCartOpen, wishlist, toggleWishlist } = useCart();
  const [addedItems, setAddedItems] = useState<number[]>([]);
  
  // State for Filters
  const [selectedCategory, setSelectedCategory] = useState(defaultCategory);
  const [priceRange, setPriceRange] = useState({ min: defaultMin, max: defaultMax });
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [selectedCondition, setSelectedCondition] = useState('All');
  const [minRating, setMinRating] = useState(0);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Derive categories and brands dynamically from products
  const categories = useMemo(() => {
    return ['All', ...Array.from(new Set(products.map(p => p.category)))];
  }, []);

  const brands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brand).filter(Boolean) as string[]));
  }, []);

  const filteredProducts = products.filter(product => {
    // Category Filter
    if (selectedCategory !== 'All' && product.category !== selectedCategory) {
      return false;
    }
    // Brand Filter
    if (selectedBrand !== 'All' && product.brand !== selectedBrand) {
      return false;
    }
    // Condition Filter
    if (selectedCondition !== 'All' && product.condition !== selectedCondition) {
      return false;
    }
    // Rating Filter
    if (product.rating < minRating) {
      return false;
    }
    // Price Filter
    if (product.rawPrice < priceRange.min || (priceRange.max > 0 && product.rawPrice > priceRange.max)) {
      return false;
    }
    return true;
  });

  const handleAddToCart = (e: React.MouseEvent, product: typeof products[0]) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product, 1);
    
    // Capture the bounding rect of the clicked element (button)
    const rect = e.currentTarget.getBoundingClientRect();

    // Trigger global toast with position
    if (onProductAdded) {
      onProductAdded(product, rect);
    }
    
    // Show visual feedback on button
    const pid = typeof product.id === 'string' ? parseInt(product.id) : product.id;
    setAddedItems(prev => [...prev, pid]);
    setTimeout(() => {
      setAddedItems(prev => prev.filter(id => id !== pid));
    }, 2000);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setPriceRange({ min: 0, max: 100000000 });
    setSelectedBrand('All');
    setSelectedCondition('All');
    setMinRating(0);
  };

  return (
    <>
      <ProductFilters 
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        
        minPrice={priceRange.min}
        maxPrice={priceRange.max}
        onPriceChange={(min, max) => setPriceRange({ min, max })}
        
        brands={brands}
        selectedBrand={selectedBrand}
        onSelectBrand={setSelectedBrand}
        
        selectedCondition={selectedCondition}
        onSelectCondition={setSelectedCondition}
        
        minRating={minRating}
        onSelectRating={setMinRating}
        
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <section className="max-w-[1400px] mx-auto px-3 md:px-6 pt-6 md:pt-8 pb-20">
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div>
             {title === "Featured Products" && <span className="text-red-600 font-bold uppercase tracking-wider text-xs md:text-sm">Best Sellers</span>}
             <h2 className="text-xl md:text-3xl font-bold text-gray-900 mt-1">{title}</h2>
          </div>
          
          <div className="flex items-center gap-4">
            {showViewAll && <Link to="#" className="text-gray-500 hover:text-red-600 font-medium transition-colors text-xs md:text-base hidden sm:block">View all products</Link>}
          </div>
        </div>
        
        {filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <p className="text-gray-500 text-lg">No products found matching your filters.</p>
            <button 
              onClick={handleResetFilters} 
              className="mt-4 text-red-600 font-semibold hover:underline"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6" 
            : "flex flex-col gap-3 md:gap-4"
          }>
            {filteredProducts.map((product, index) => {
              const pid = typeof product.id === 'string' ? parseInt(product.id) : product.id;
              const isAdded = addedItems.includes(pid);
              const isWishlisted = wishlist.includes(pid);

              return (
                <React.Fragment key={product.id}>
                  
                  {/* 
                    VIEW LOGIC:
                    1. Grid Mode: Always uses ProductGridItem (Vertical Card).
                    2. List Mode (Mobile): Uses ProductGridItem (Vertical Card) in a single column stack.
                    3. List Mode (Desktop): Uses ProductListItem (Horizontal Row).
                  */}
                  
                  {viewMode === 'grid' ? (
                    <ProductGridItem 
                      product={product} 
                      onAddToCart={handleAddToCart} 
                      isAdded={isAdded}
                      viewMode="grid"
                      isWishlisted={isWishlisted}
                      onToggleWishlist={() => toggleWishlist(pid)}
                    />
                  ) : (
                    <>
                      {/* Mobile List View: Re-use Grid Design (Vertical Card), but pass viewMode='list' to show details */}
                      <div className="block md:hidden">
                         <ProductGridItem 
                          product={product} 
                          onAddToCart={handleAddToCart} 
                          isAdded={isAdded}
                          viewMode="list" 
                          isWishlisted={isWishlisted}
                          onToggleWishlist={() => toggleWishlist(pid)}
                        />
                      </div>
                      
                      {/* Desktop List View: Use List Design (Horizontal Row) */}
                      <div className="hidden md:block">
                        <ProductListItem 
                          product={product} 
                          onAddToCart={handleAddToCart} 
                          isAdded={isAdded} 
                          isWishlisted={isWishlisted}
                          onToggleWishlist={() => toggleWishlist(pid)}
                        />
                      </div>
                    </>
                  )}

                  {/* AUTOMATED AD INSERTION */}
                  {((index + 1) === 4 || (index + 1) === 8) && (
                    <div className={`col-span-2 ${viewMode === 'grid' ? 'lg:col-span-4' : 'w-full'} flex items-center justify-center my-2 md:my-4`}>
                        <AdUnit placementKey="FEED_INSERTION" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
};