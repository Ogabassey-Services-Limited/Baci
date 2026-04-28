'use client';

import { createContext, type ReactNode, useContext, useState } from 'react';
import type { AIResponse, Change } from '@/app/dashboard/products/actions';
import { useDebounce } from '@/hooks/use-debounce';
import { useToast } from '@/hooks/use-toast';
import { apiDelete, apiPost, apiPut } from '@/lib/api-client';
import {
  DEFAULT_PRODUCT_LIST_FILTERS,
  type MigrationFilterValue,
  type StatusFilterValue,
  type StockFilterValue,
} from '@/lib/product-list-filters';
import type { Product } from '@/lib/products';
import { useAuth } from './auth-context'; // Import the useAuth hook
import { useProductFetch } from './use-product-fetch';

export type WorkflowStep =
  | 'view'
  | 'upload'
  | 'processing'
  | 'review'
  | 'studio';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface ProductStats {
  inventoryValue: number;
  outOfStockCount: number;
  categoryCount: number;
}

interface ProductContextType {
  migrationFilter: MigrationFilterValue;
  products: Product[];
  isLoading: boolean;
  pagination: PaginationInfo;
  stats: ProductStats;
  statusFilter: StatusFilterValue;
  stockFilter: StockFilterValue;
  setMigrationFilter: (migration: MigrationFilterValue) => void;
  setStatusFilter: (status: StatusFilterValue) => void;
  setStockFilter: (stock: StockFilterValue) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
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
  isAddProductOpen: boolean;
  openAddProductDialog: (product?: Product | null) => void;
  closeAddProductDialog: () => void;
  editingProduct: Product | null;
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

import type { ProductsResult } from '@/lib/products-server';

export const ProductProvider: React.FC<{
  children: ReactNode;
  initialData?: ProductsResult;
}> = ({ children, initialData }) => {
  const { user, loading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>(
    initialData?.products || []
  );
  const [isLoading, setIsLoading] = useState(!initialData);
  const [pagination, setPagination] = useState<PaginationInfo>(
    initialData?.pagination || {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    }
  );
  const [stats, setStats] = useState<ProductStats>(
    initialData?.stats || {
      inventoryValue: 0,
      outOfStockCount: 0,
      categoryCount: 0,
    }
  );
  const [migrationFilter, setMigrationFilter] = useState<MigrationFilterValue>(
    initialData?.filters?.migration ?? DEFAULT_PRODUCT_LIST_FILTERS.migration
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(
    initialData?.filters?.status ?? DEFAULT_PRODUCT_LIST_FILTERS.status
  );
  const [stockFilter, setStockFilter] = useState<StockFilterValue>(
    initialData?.filters?.stock ?? DEFAULT_PRODUCT_LIST_FILTERS.stock
  );
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('view');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState(
    initialData?.filters?.search ?? DEFAULT_PRODUCT_LIST_FILTERS.search
  );
  // ⚡ Bolt: Debounce the searchTerm to prevent triggering a refetch on every keystroke,
  // which reduces unnecessary server load and improves frontend responsiveness.
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { toast } = useToast();

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const openAddProductDialog = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsAddProductOpen(true);
  };

  const closeAddProductDialog = () => {
    setIsAddProductOpen(false);
    setEditingProduct(null);
  };

  const { fetchProducts } = useProductFetch<Product>({
    authLoading,
    user,
    initialData,
    pagination,
    migrationFilter,
    searchTerm: debouncedSearchTerm,
    statusFilter,
    stockFilter,
    setProducts,
    setPagination,
    setStats,
    setIsLoading,
    toast,
  });

  const setPage = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const addProduct = async (product: Product) => {
    try {
      await apiPost('/api/products', product);

      await fetchProducts(true);
    } catch (error) {
      console.error('Error adding product:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to add product',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateProduct = async (product: Product) => {
    try {
      await apiPut(`/api/products/${product.id}`, product);

      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? product : p))
      );
      await fetchProducts(true);
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
      await apiDelete(`/api/products/${productId}`);

      setProducts((prev) => prev.filter((p) => p.id !== productId));
      await fetchProducts(true);
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
    try {
      const result = await apiPost<{
        results: {
          updated: number;
          created: number;
          removed: number;
          errors: unknown[];
        };
      }>('/api/products/bulk-update', { changes: changesToApply });

      toast({
        title: 'Catalog Updated!',
        description: `Successfully applied ${result.results.updated} updates, ${result.results.created} new products, and ${result.results.removed} removals.`,
      });

      if (result.results.errors.length > 0) {
        console.error(result.results.errors);
        toast({
          title: 'Some errors occurred',
          description: 'Check console for details on failed items.',
          variant: 'destructive',
        });
      }

      setWorkflowStep('view');
      setAiResponse(null);
      await fetchProducts(true);
    } catch (error) {
      console.error('Error applying changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to apply changes to the database.',
        variant: 'destructive',
      });
    }
  };

  return (
    <ProductContext.Provider
      value={{
        products,
        isLoading: isLoading || authLoading, // Combine loading states
        pagination,
        stats,
        migrationFilter,
        statusFilter,
        stockFilter,
        setMigrationFilter,
        setStatusFilter,
        setStockFilter,
        setPage,
        setLimit: (limit: number) =>
          setPagination((prev) => ({ ...prev, limit })),
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
        isAddProductOpen,
        openAddProductDialog,
        closeAddProductDialog,
        editingProduct,
      }}
    >
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
