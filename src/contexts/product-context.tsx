
'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo } from 'react';
import { products as initialProducts, type Product } from '@/lib/products';
import { AIResponse, Change } from '@/app/dashboard/products/actions';
import { useToast } from '@/hooks/use-toast';
import Fuse from 'fuse.js';

export type WorkflowStep = 'view' | 'upload' | 'processing' | 'review';

interface ProductContextType {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  workflowStep: WorkflowStep;
  setWorkflowStep: React.Dispatch<React.SetStateAction<WorkflowStep>>;
  aiResponse: AIResponse | null;
  setAiResponse: React.Dispatch<React.SetStateAction<AIResponse | null>>;
  applyChanges: (changesToApply: Change[]) => void;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('view');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const applyChanges = (changesToApply: Change[]) => {
    setProducts(currentProducts => {
      let updatedProducts = [...currentProducts];
      changesToApply.forEach(change => {
        if (change.type === 'update') {
          updatedProducts = updatedProducts.map(p => 
            p.id === change.productId ? { ...p, price: change.newPrice! } : p
          );
        } else if (change.type === 'new') {
          const newProduct: Product = {
            id: change.details.sku || `new-${Date.now()}`,
            name: change.details.name,
            description: change.details.description || 'No description provided.',
            price: change.details.price,
            status: 'draft',
            stock: change.details.stock || 0,
            image: 'https://picsum.photos/seed/new/80/80',
            imageLarge: 'https://picsum.photos/seed/new/600/400',
            imageHint: 'new product',
            brand: change.details.brand || 'Unknown',
            gtin: change.details.sku || '',
            mpn: change.details.sku || '',
          };
          updatedProducts.push(newProduct);
        } else if (change.type === 'remove') {
          updatedProducts = updatedProducts.filter(p => p.id !== change.productId);
        }
      });
      return updatedProducts;
    });

    toast({
        title: 'Catalog Updated!',
        description: `${changesToApply.length} change(s) have been applied.`
    });
    setWorkflowStep('view');
    setAiResponse(null);
  };

  return (
    <ProductContext.Provider value={{
      products,
      setProducts,
      workflowStep,
      setWorkflowStep,
      aiResponse,
      setAiResponse,
      applyChanges,
      searchTerm,
      setSearchTerm,
    }}>
      {children}
    </ProductContext.Provider>
  );
};

export const useProductContext = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
};
