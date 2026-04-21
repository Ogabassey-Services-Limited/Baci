import * as Crypto from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { useMerchant } from '@/hooks/useMerchant';
import { useProductNameSuggestions } from '@/hooks/useProductNameSuggestions';
import {
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useProduct,
  useUpdateProduct,
  useUpdateProductStatus,
} from '@/hooks/useProducts';
import { createInitialProductEditFormData } from '@/components/product/product-edit.defaults';
import { normalizeComparableProductName } from '@/lib/product-matching';
import {
  buildVariantFormValues,
} from '@/lib/product-variant-form';
import { stripHtmlTags } from '@/lib/utils';
import type { ProductEditFormData } from '@/components/product/product-edit.types';
import { createProductEditImageActions } from './createProductEditImageActions';
import { createProductEditPersistenceActions } from './createProductEditPersistenceActions';
import { createProductEditVariantActions } from './createProductEditVariantActions';

const routeParamsSchema = z.object({
  id: z.union([z.literal('new'), z.string().uuid()]),
});

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
    createInitialProductEditFormData(isEditing ? '' : rawParams.sku || generateSKU())
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
  const updateProductMutation = useUpdateProduct();
  const createProductMutation = useCreateProduct();
  const updateStatusMutation = useUpdateProductStatus();
  const saveInFlightRef = useRef(false);

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

  useEffect(() => {
    if (!product || isInitialized) {
      return;
    }

    setFormData({
      brand: product.brand ?? product.brands?.name ?? '',
      category: product.category || '',
      category_id: product.category_id || '',
      color: product.color || '',
      cost_price: product.cost_price || 0,
      description: stripHtmlTags(product.description || ''),
      fulfillment_details:
        product.fulfillment_details &&
        typeof product.fulfillment_details === 'object' &&
        'items' in product.fulfillment_details
          ? (product.fulfillment_details as {
              items: Array<{ imei: string; serial_number: string }>;
            })
          : {
              items: Array.from({ length: product.stock_quantity || 0 }, () => ({
                imei: '',
                serial_number: '',
              })),
            },
      has_variants: product.has_variants || product.variants.length > 0,
      images: (product.images as string[]) || [],
      low_stock_threshold: product.low_stock_threshold || 3,
      manage_stock: product.manage_stock ?? true,
      name: product.name || '',
      price: product.price || 0,
      sku: product.sku || '',
      status: (product.status as 'active' | 'draft' | 'archived') || 'active',
      stock_quantity: product.stock_quantity || 0,
      variant_attributes: product.variant_attributes
        ? Object.entries(product.variant_attributes as Record<string, unknown>).map(
            ([key, value]) => ({
              key,
              value: String(value),
            })
          )
        : [],
      variants: buildVariantFormValues(product.variants, {
        costPrice: product.cost_price || 0,
        price: product.price || 0,
      }),
    });
    setIsInitialized(true);
  }, [isInitialized, product]);

  const updateFormData = (updates: Partial<ProductEditFormData>) => {
    setFormData((previous) => ({ ...previous, ...updates }));
  };

  const {
    handleCreateCategory,
    handleSave,
    handleStatusToggle,
  } = createProductEditPersistenceActions({
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
    resetCategoryForm: () => {
      setNewCategoryName('');
      setIsCreatingCategory(false);
      setIsCategoryModalVisible(false);
    },
    revertStatus: (status) =>
      setFormData((previous) => ({ ...previous, status })),
    routerBack: () => router.back(),
    saveInFlightRef,
    selectCreatedCategory: (categoryId, categoryName) =>
      setFormData((previous) => ({
        ...previous,
        category: categoryName,
        category_id: categoryId,
      })),
    updateProduct: updateProductMutation.mutateAsync,
    updateStatus: (input, callbacks) =>
      updateStatusMutation.mutate(input, callbacks),
  });

  const {
    addAttribute,
    addVariant,
    addVariantAttribute,
    adjustStock,
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
    updateFulfillmentItem,
    updateVariant,
    updateVariantAttribute,
    updateVariantCondition,
    addAttribute,
    addVariant,
    addVariantAttribute,
    adjustStock,
    isMerchantLoading,
    removeAttribute,
    removeVariant,
    removeVariantAttribute,
    updateProductMutation,
    updateStatusMutation,
  };
}
