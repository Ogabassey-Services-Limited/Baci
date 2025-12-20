import React, { useState } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { CartProvider } from './contexts/CartContext';
import { CartDrawer } from './components/CartDrawer';
import { ProductGrid } from './components/ProductGrid';
import { UpsellToast } from './components/UpsellToast';
import { FloatingParticles } from './components/FloatingParticles';
import { Product } from './types';

const App: React.FC = () => {
  const [notificationProduct, setNotificationProduct] = useState<Product | null>(null);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [particles, setParticles] = useState<{id: number, x: number, y: number}[]>([]);

  const handleProductAdded = (product: Product, rect?: DOMRect) => {
    setNotificationProduct(product);
    if (rect) {
      // Store plain object to avoid potential serialization issues
      setAnchorRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });

      // Add floating particle
      const id = Date.now() + Math.random(); // Ensure unique ID
      setParticles(prev => [...prev, { 
        id, 
        x: rect.left + (rect.width / 2), 
        y: rect.top + (rect.height / 2) 
      }]);

      // Remove particle after animation
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 1000);
    } else {
      setAnchorRect(null);
    }
  };

  return (
    <Router>
      <CartProvider>
        <div className="min-h-screen bg-[#FAFAFA] font-sans text-gray-900 antialiased selection:bg-red-500/20 selection:text-red-600 relative">
          {/* CartDrawer is retained so "Add to Cart" functionality has visual feedback when manually opened */}
          <CartDrawer />
          
          <main>
            {/* The Best Sellers / Featured Products Section */}
            <ProductGrid 
              title="Featured Products" 
              showViewAll={true} 
              onProductAdded={handleProductAdded}
            />
          </main>

          {/* AI Upsell Notification */}
          <UpsellToast 
            product={notificationProduct} 
            anchorRect={anchorRect}
            onClose={() => setNotificationProduct(null)} 
          />

          {/* Floating +1 Particles */}
          <FloatingParticles particles={particles} />
        </div>
      </CartProvider>
    </Router>
  );
};

export default App;