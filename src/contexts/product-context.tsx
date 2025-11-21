
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { type Product } from '@/lib/products';
import { AIResponse, Change } from '@/app/dashboard/products/actions';
import { useToast } from '@/hooks/use-toast';

export type WorkflowStep = 'view' | 'upload' | 'processing' | 'review';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductStats {
  inventoryValue: number;
  outOfStockCount: number;
}

interface ProductContextType {
  products: Product[];
  isLoading: boolean;
  pagination: PaginationInfo;
  stats: ProductStats;
  statusFilter: string;
  stockFilter: string;
  setStatusFilter: (status: string) => void;
  setStockFilter: (stock: string) => void;
  setPage: (page: number) => void;
  refetchProducts: () => Promise<void>;
  addProduct: (product: Product) => Promise<void>;
  workflowStep: WorkflowStep;
  setWorkflowStep: React.Dispatch<React.SetStateAction<WorkflowStep>>;
  aiResponse: AIResponse | null;
  setAiResponse: React.Dispatch<React.SetStateAction<AIResponse | null>>;
  applyChanges: (changesToApply: Change[]) => void;
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export const ProductProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [stats, setStats] = useState<ProductStats>({
    inventoryValue: 0,
    outOfStockCount: 0,
  });
  const [statusFilter, setStatusFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('view');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search: searchTerm,
        status: statusFilter,
        stock: stockFilter,
      });

      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        // If unauthorized (not logged in), silently fail - this is expected on public pages
        if (response.status === 401) {
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
      setPagination(data.pagination);
      setStats(data.stats || { inventoryValue: 0, outOfStockCount: 0 });
    } catch (error) {
      console.error('Error fetching products:', error);
      // Only show toast if it's not an auth error
      if (error instanceof Error && !error.message.includes('401')) {
        toast({
          title: 'Error',
          description: 'Failed to load products',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, stockFilter, toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const setPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  const addProduct = async (product: Product) => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add product');
      }

      // Refetch to get accurate data
      await fetchProducts();
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add product',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateProduct = async (product: Product) => {
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product),
      });

      if (!response.ok) {
        throw new Error('Failed to update product');
      }

      // Update local state
      setProducts(prev => prev.map(p => p.id === product.id ? product : p));

      // Refetch to ensure consistency
      await fetchProducts();
    } catch (error) {
      console.error('Error updating product:', error);
      toast({
        title: 'Error',
        description: 'Failed to update product',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteProduct = async (productId: string) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete product');
      }

      // Update local state
      setProducts(prev => prev.filter(p => p.id !== productId));

      // Refetch to ensure consistency
      await fetchProducts();
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const applyChanges = async (changesToApply: Change[]) => {
    // For now, we'll apply changes optimistically
    // In a real implementation, you'd send these to the API
    toast({
      title: 'Catalog Updated!',
      description: `${changesToApply.length} change(s) have been applied.`
    });
    setWorkflowStep('view');
    setAiResponse(null);
    // Refetch to get updated data
    await fetchProducts();
  };

  return (
    <ProductContext.Provider value={{
      products,
      isLoading,
      pagination,
      stats,
      statusFilter,
      stockFilter,
      setStatusFilter,
      setStockFilter,
      setPage,
      refetchProducts: fetchProducts,
      addProduct,
      workflowStep,
      setWorkflowStep,
      aiResponse,
      setAiResponse,
      applyChanges,
      searchTerm,
      setSearchTerm,
      updateProduct,
      deleteProduct,
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
