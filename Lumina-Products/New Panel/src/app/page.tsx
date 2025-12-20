'use client';

import React, { useState } from 'react';
import { CartDrawer } from '@/components/CartDrawer';
import { ProductGrid } from '@/components/ProductGrid';
import { UpsellToast } from '@/components/UpsellToast';
import { FloatingParticles } from '@/components/FloatingParticles';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Product } from '@/types';

export default function Home() {
  const [notificationProduct, setNotificationProduct] = useState<Product | null>(null);
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [particles, setParticles] = useState<{id: number, x: number, y: number}[]>([]);

  const handleProductAdded = (product: Product, rect?: DOMRect) => {
    setNotificationProduct(product);
    if (rect) {
      setAnchorRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });

      const id = Date.now() + Math.random();
      setParticles(prev => [...prev, { 
        id, 
        x: rect.left + (rect.width / 2), 
        y: rect.top + (rect.height / 2) 
      }]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 1000);
    } else {
      setAnchorRect(null);
    }
  };

  return (
    <div className="relative selection:bg-red-500/20 selection:text-red-600">
      <Navbar />
      <CartDrawer />
      
      <main>
        <Hero />
        <ProductGrid 
          title="Featured Products" 
          showViewAll={true} 
          onProductAdded={handleProductAdded}
        />
      </main>

      <UpsellToast 
        product={notificationProduct} 
        anchorRect={anchorRect}
        onClose={() => setNotificationProduct(null)} 
      />

      <FloatingParticles particles={particles} />
    </div>
  );
}