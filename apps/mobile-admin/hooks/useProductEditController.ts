import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import { useMerchant } from '@/hooks/useMerchant';
import { useProductNameSuggestions } from '@/hooks/useProductNameSuggestions';
import {
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useInventoryStats,
  useProduct,
  useUpdateProduct,
  useUpdateProductStatus,
} from '@/hooks/useProducts';
import { baciFeatureGates } from '@/lib/feature-gates';
import { normalizeComparableProductName } from '@/lib/product-matching';
import { routeParamsSchema } from '@/schemas/product-route-params';
import { createProductEditImageActions } from './createProductEditImageActions';
import { createProductEditPersistenceActions } from './createProductEditPersistenceActions';
import { createProductEditVariantActions } from './createProductEditVariantActions';
import { buildProductEditFormData } from './product-edit-form-data';

export function useProductEditController() {
  const rawParams = useLocalSearchParams<{ id: string; sku?: string }>();
  const router = useRouter();
  const { merchant, isLoading: isMerchantLoading } = useMerchant();

  const validatedParams = (() => {
    const result = routeParamsSchema.safeParse(rawParams);
    return result.success ? result.data : null;
  })();
  const id = validatedParams?.id;
  const isEditing = id !== 'new' && id !== undefined;
  const generateSKU = () =>
    `SKU-${Crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;

  const [formData, setFormData] = useState<ProductEditFormData>(() =>
    createInitialProductEditFormData(
      isEditing ? '' : rawParams.sku || generateSKU()
    )
  );
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isFulfillmentModalVisible, setIsFulfillmentModalVisible] =
    useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const { data: product, error: productError } = useProduct(id ?? 'new');
  const { data: inventoryStats } = useInventoryStats();
  const updateProductMutation = useUpdateProduct();
  const createProductMutation = useCreateProduct();
  const updateStatusMutation = useUpdateProductStatus();
  const [saveInFlightLock] = useState(() => ({ current: false }));

  const { data: productNameSuggestions = [] } = useProductNameSuggestions({
    productName: formData.name,
    excludeProductId: isEditing ? id : undefined,
    enabled: !isEditing,
  });

  const exactProductSuggestion = productNameSuggestions.find(
    (suggestion) =>
      suggestion.isExact &&
      normalizeComparableProductName(suggestion.product.name) ===
        normalizeComparableProductName(formData.name)
  )?.product;

  const hasVariantConditionAxis = formData.variants.some(
    (variant) =>
      typeof variant.condition === 'string' && variant.condition.trim() !== ''
  );

  if (product && !isInitialized) {
    setFormData(buildProductEditFormData(product));
    setIsInitialized(true);
  }

  const updateFormData = (updates: Partial<ProductEditFormData>) => {
    setFormData((previous) => ({ ...previous, ...updates }));
  };
  const updatePricing = (
    updates: Pick<Partial<ProductEditFormData>, 'cost_price' | 'price'>
  ) => updateFormData(updates);
  const updateInventory = (
    updates: Pick<
      Partial<ProductEditFormData>,
      'low_stock_threshold' | 'manage_stock'
    >
  ) => updateFormData(updates);

  const updateCategory = (category: { id: string; name: string }) => {
    setFormData((previous) => ({
      ...previous,
      category: category.name,
      category_id: category.id,
    }));
  };

  const { handleCreateCategory, handleSave, handleStatusToggle } =
    createProductEditPersistenceActions({
      createCategory: (name, callbacks) =>
        createCategoryMutation.mutate(name, callbacks),
      createProduct: createProductMutation.mutateAsync,
      exactProductSuggestion,
      formData,
      hasVariantConditionAxis,
      id: id === 'new' ? undefined : id,
      isEditing,
      newCategoryName,
      openProduct: (productId) => router.push(`/product/${productId}`),
      productCreationGate: {
        ...baciFeatureGates.canCreateProduct({
          activeProductCount: inventoryStats?.totalProducts,
          merchant,
        }),
        onUpgrade: () => router.push('/(admin)/subscribe'),
      },
      resetCategoryForm: () => {
        setNewCategoryName('');
        setIsCreatingCategory(false);
        setIsCategoryModalVisible(false);
      },
      revertStatus: (status) =>
        setFormData((previous) => ({ ...previous, status })),
      routerBack: () => router.back(),
      saveInFlightRef: saveInFlightLock,
      selectCreatedCategory: (categoryId, categoryName) =>
        updateCategory({ id: categoryId, name: categoryName }),
      // Capture the loaded product's PRE-SAVE category so a category MOVE also
      // purges the OLD category's cached storefront URLs (see product-save).
      updateProduct: (input) =>
        updateProductMutation.mutateAsync({
          ...input,
          previousCategory: product?.category ?? null,
          previousCategoryId: product?.category_id ?? null,
        }),
      updateStatus: (input, callbacks) =>
        updateStatusMutation.mutate(input, callbacks),
    });

  const {
    addAttribute,
    addVariant,
    addVariantAttribute,
    adjustStock,
    applyVariantPricing,
    generateVariants,
    removeAttribute,
    removeVariant,
    removeVariantAttribute,
    updateAttribute,
    updateFulfillmentItem,
    updateVariant,
    updateVariantAttribute,
    updateVariantCondition,
  } = createProductEditVariantActions({
    formData,
    setFormData,
  });

  const { handleImagePick } = createProductEditImageActions({
    merchantId: merchant?.id,
    setFormData,
    setIsUploading,
  });

  return {
    categories,
    createCategoryMutation,
    createProductMutation,
    exactProductSuggestion,
    formData,
    handleCreateCategory,
    handleImagePick,
    handleSave,
    handleStatusToggle,
    hasVariantConditionAxis,
    id,
    isCategoryModalVisible,
    isCreatingCategory,
    isEditing,
    isFulfillmentModalVisible,
    isInitialized,
    isUploading,
    merchant,
    newCategoryName,
    product,
    productError,
    productNameSuggestions,
    setFormData,
    setIsCategoryModalVisible,
    setIsCreatingCategory,
    setIsFulfillmentModalVisible,
    setNewCategoryName,
    updateAttribute,
    updateBasicInformation: updateFormData,
    updateCategory,
    updateFulfillmentItem,
    updateInventory,
    updatePricing,
    updateVariant,
    updateVariantAttribute,
    updateVariantCondition,
    addAttribute,
    addVariant,
    addVariantAttribute,
    adjustStock,
    applyVariantPricing,
    generateVariants,
    isMerchantLoading,
    removeAttribute,
    removeVariant,
    removeVariantAttribute,
    updateProductMutation,
    updateStatusMutation,
  };
}
