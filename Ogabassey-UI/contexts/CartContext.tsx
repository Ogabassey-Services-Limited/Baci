import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem, Product } from '../types';

interface CartContextType {
  cartItems: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  addToCart: (product: Product, quantity: number, options?: { color?: string; colorValue?: string; secondaryColor?: string; secondaryColorValue?: string; storage?: string }) => void;
  removeFromCart: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, change: number) => void;
  applyNegotiatedPrice: (cartItemId: string, newPrice: number) => void;
  applyCartWideNegotiation: (newTotal: number) => void;
  toggleAssurance: (cartItemId: string) => void;
  totalItems: number;
  subtotal: number;
  // Upsell State
  lastAddedProduct: Product | null;
  showUpsell: boolean;
  dismissUpsell: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Upsell State
  const [lastAddedProduct, setLastAddedProduct] = useState<Product | null>(null);
  const [showUpsell, setShowUpsell] = useState(false);

  // Calculate totals
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  
  const subtotal = cartItems.reduce((sum, item) => {
    const priceToUse = item.negotiatedPrice !== undefined ? item.negotiatedPrice : item.rawPrice;
    const itemTotal = priceToUse * item.quantity;
    const assuranceCost = item.hasAssurance ? (itemTotal * 0.05) : 0;
    return sum + itemTotal + assuranceCost;
  }, 0);

  const addToCart = (product: Product, quantity: number, options: { color?: string; colorValue?: string; secondaryColor?: string; secondaryColorValue?: string; storage?: string } = {}) => {
    const cartItemId = `${product.id}-${options.color || ''}-${options.storage || ''}`;
    
    // Trigger Upsell Logic
    setLastAddedProduct(product);
    // Use a small timeout so the toast feels like a reaction to the add action
    setTimeout(() => {
        setShowUpsell(true);
    }, 500);

    setCartItems(prev => {
      const existingItem = prev.find(item => item.cartItemId === cartItemId);
      if (existingItem) {
        return prev.map(item => 
          item.cartItemId === cartItemId 
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { 
        ...product, 
        cartItemId, 
        quantity, 
        selectedColor: options.color, 
        selectedColorValue: options.colorValue,
        secondaryColor: options.secondaryColor,
        secondaryColorValue: options.secondaryColorValue,
        selectedStorage: options.storage,
        negotiationStatus: 'none',
        hasAssurance: false
      }];
    });
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, change: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQuantity = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const applyNegotiatedPrice = (cartItemId: string, newPrice: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        return { 
          ...item, 
          negotiatedPrice: newPrice,
          negotiationStatus: 'accepted'
        };
      }
      return item;
    }));
  };

  const applyCartWideNegotiation = (newTotal: number) => {
    const currentActiveBaseTotal = cartItems.reduce((sum, item) => {
        const priceToUse = item.negotiatedPrice !== undefined ? item.negotiatedPrice : item.rawPrice;
        return sum + (priceToUse * item.quantity);
    }, 0);

    if (currentActiveBaseTotal <= 0) return;

    const ratio = newTotal / currentActiveBaseTotal;

    setCartItems(prev => prev.map(item => {
        const currentPrice = item.negotiatedPrice !== undefined ? item.negotiatedPrice : item.rawPrice;
        const newUnitPrice = currentPrice * ratio;
        
        return {
            ...item,
            negotiatedPrice: newUnitPrice,
            negotiationStatus: 'accepted'
        };
    }));
  };

  const toggleAssurance = (cartItemId: string) => {
    setCartItems(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        return { ...item, hasAssurance: !item.hasAssurance };
      }
      return item;
    }));
  };

  const dismissUpsell = () => {
      setShowUpsell(false);
  };

  return (
    <CartContext.Provider value={{
      cartItems,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      updateQuantity,
      applyNegotiatedPrice,
      applyCartWideNegotiation,
      toggleAssurance,
      totalItems,
      subtotal,
      lastAddedProduct,
      showUpsell,
      dismissUpsell
    }}>
      {children}
    </CartContext.Provider>
  );
};