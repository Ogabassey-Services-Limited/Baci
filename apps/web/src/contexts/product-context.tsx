'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { AIResponse, Change } from '@/app/dashboard/products/actions';
import { useToast } from '@/hooks/use-toast';
import { apiDelete, apiPost, apiPut } from '@/lib/api-client';
import type { Product } from '@/lib/products';
import { useAuth } from './auth-context'; // Import the useAuth hook

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
  products: Product[];
  isLoading: boolean;
  pagination: PaginationInfo;
  stats: ProductStats;
  statusFilter: string;
  stockFilter: string;
  setStatusFilter: (status: string) => void;
  setStockFilter: (stock: string) => void;
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
  const [statusFilter, setStatusFilter] = useState('All');
  const [stockFilter, setStockFilter] = useState('All');
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('view');
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const fetchInProgressRef = useRef(false);
  const lastFetchParamsRef = useRef<string>('');
  const lastFetchTimeRef = useRef<number>(0);

  const openAddProductDialog = (product: Product | null = null) => {
    setEditingProduct(product);
    setIsAddProductOpen(true);
  };

  const closeAddProductDialog = () => {
    setIsAddProductOpen(false);
    setEditingProduct(null);
  };

  const fetchProducts = async (force = false) => {
    // **FIX**: Do not fetch if auth is still loading or if there's no user
    if (authLoading || !user) {
      // If we know there's no user, stop loading and clear data.
      if (!authLoading && !user) {
        setProducts([]);
        setIsLoading(false);
      }
      return;
    }

    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search: searchTerm,
      status: statusFilter,
      stock: stockFilter,
    });
    const paramsString = params.toString();

    // Prevent rapid re-fetching (throttle to 1s)
    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current;
    if (now - lastFetch < 1000) {
      if (process.env.NODE_ENV === 'development') {
        console.log('Throttling product fetch');
      }
      return;
    }

    lastFetchTimeRef.current = now;

    // Prevent duplicate fetches with same parameters
    if (
      !force &&
      (fetchInProgressRef.current ||
        paramsString === lastFetchParamsRef.current)
    ) {
      return;
    }

    fetchInProgressRef.current = true;
    lastFetchParamsRef.current = paramsString;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/products?${params}`);
      if (!response.ok) {
        // Silently fail on 401/403/404/500/429
        if ([401, 403, 404, 500, 429].includes(response.status)) {
          if (response.status === 429) {
            console.warn(
              'Rate limit hit for products fetch. Retrying in 5s...'
            );
            // Optional: Validation or backoff logic here
          }
          fetchInProgressRef.current = false;
          setIsLoading(false);
          return;
        }
        console.error(
          `Fetch failed with status: ${response.status} ${response.statusText}`
        );
        throw new Error(`Failed to fetch products: ${response.status}`);
      }

      const data = await response.json();
      setProducts(data.products || []);
      setPagination(data.pagination);
      setStats(
        data.stats || {
          inventoryValue: 0,
          outOfStockCount: 0,
          categoryCount: 0,
        }
      );
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Error',
        description: 'Failed to load products',
        variant: 'destructive',
      });
    } finally {
      fetchInProgressRef.current = false;
      setIsLoading(false);
    }
  };

  // Removed automatic fetch on mount since we hydrate from server data
  // Only re-fetch when filters/pagination change AFTER initial load
  // We use a ref to track if it's the first render
  const isFirstRender = useRef(true);

  // biome-ignore lint/correctness/useExhaustiveDependencies: fetchProducts is stable, dependencies managed explicitly
  useEffect(() => {
    // Skip the first render if we have initialData, as it matches the server state
    if (initialData && isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchProducts();
  }, [
    pagination,
    searchTerm,
    statusFilter,
    stockFilter,
    user,
    authLoading,
    initialData,
  ]);

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
        statusFilter,
        stockFilter,
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
