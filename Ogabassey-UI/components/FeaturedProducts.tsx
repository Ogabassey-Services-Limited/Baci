import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { products } from '../data/products';
import { useCart } from '../contexts/CartContext';
import { AdUnit } from './AdUnit';
import { ProductCard } from './ProductCard';
import { Product } from '../types';

interface FeaturedProductsProps {
  selectedCategory?: string;
  minPrice?: number;
  maxPrice?: number;
  title?: string;
  showViewAll?: boolean;
  viewMode?: 'grid' | 'list';
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({ 
  selectedCategory = 'All', 
  minPrice = 0, 
  maxPrice = 10000000,
  title = "Featured Products",
  showViewAll = true,
  viewMode = 'grid'
}) => {
  const { addToCart } = useCart();
  const [addedItems, setAddedItems] = useState<number[]>([]);

  const filteredProducts = products.filter(product => {
    // Category Filter
    if (selectedCategory !== 'All' && product.category !== selectedCategory) {
      return false;
    }
    // Price Filter
    if (product.rawPrice < minPrice || (maxPrice > 0 && product.rawPrice > maxPrice)) {
      return false;
    }
    return true;
  });

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product, 1);
    
    // Show visual feedback
    const pid = typeof product.id === 'string' ? parseInt(product.id) : product.id;
    setAddedItems(prev => [...prev, pid]);
    setTimeout(() => {
      setAddedItems(prev => prev.filter(id => id !== pid));
    }, 2000);
  };

  // Determine the link destination
  const viewAllLink = selectedCategory === 'All' ? '/category/All' : `/category/${selectedCategory}`;

  return (
    <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-6 md:pt-8 pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
           {title === "Featured Products" && <span className="text-red-600 font-bold uppercase tracking-wider text-sm">Best Sellers</span>}
           <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">{title}</h2>
        </div>
        
        {showViewAll && <Link to={viewAllLink} className="text-gray-500 hover:text-red-600 font-medium transition-colors text-sm md:text-base hidden sm:block">View all products</Link>}
      </div>
      
      {filteredProducts.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
          <p className="text-gray-500 text-lg">No products found matching your filters.</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-red-600 font-semibold hover:underline">Reset Filters</button>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
            ? "grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6" 
            : "flex flex-col gap-4"
        }>
          {filteredProducts.map((product, index) => {
            // Helper to check if item is added
            const isAdded = addedItems.includes(typeof product.id === 'string' ? parseInt(product.id) : product.id);

            return (
              <React.Fragment key={product.id}>
                
                <ProductCard 
                  product={product} 
                  onAddToCart={handleAddToCart} 
                  isAdded={isAdded} 
                  viewMode={viewMode}
                />

                {/* AUTOMATED AD INSERTION */}
                {((index + 1) === 4 || (index + 1) === 8) && (
                  <div className={`col-span-1 ${viewMode === 'grid' ? 'col-span-2 lg:col-span-4' : 'w-full'} flex items-center justify-center my-4`}>
                      <AdUnit placementKey="PRODUCT_GRID_IN_FEED" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
};