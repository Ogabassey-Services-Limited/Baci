/**
 * Product Edit Screen
 * Manage product details and inventory
 */

import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';
import { ExistingProductSuggestions } from '@/components/product/ExistingProductSuggestions';
import { InvalidRouteScreen } from '@/components/ui/InvalidRouteScreen';
import SafeImage from '@/components/ui/SafeImage';
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
import { useTheme } from '@/hooks/useTheme';
import { normalizeComparableProductName } from '@/lib/product-matching';
import { runSingleFlight } from '@/lib/single-flight';
import { supabase } from '@/lib/supabase';
import { stripHtmlTags } from '@/lib/utils';

// Route param validation - accepts UUID or 'new' for creating new products
const routeParamsSchema = z.object({
  id: z.union([z.literal('new'), z.string().uuid()]),
});

// Helper to get currency symbol
const getCurrencySymbol = (currencyCode: string | null | undefined) => {
  const symbols: Record<string, string> = {
    NGN: '₦',
    USD: '$',
    GBP: '£',
    EUR: '€',
  };
  return symbols[currencyCode || 'NGN'] || '₦';
};

// Formatted Price Input Component
const PriceInput = ({
  value,
  onChange,
  placeholder,
  colors,
  currencySymbol,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder: string;
  colors: Record<string, string>;
  currencySymbol: string;
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [displayValue, setDisplayValue] = useState('');

  // Sync with prop when not focused (initial load or external update)
  useEffect(() => {
    if (!isFocused) {
      setDisplayValue(value ? value.toLocaleString() : '');
    }
  }, [value, isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number for editing, removing commas
    setDisplayValue(value ? value.toString() : '');
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format with commas on blur
    setDisplayValue(value ? value.toLocaleString() : '');
  };

  const handleChangeText = (text: string) => {
    // Remove all non-numeric characters except decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimals
    const parts = cleaned.split('.');
    const sanitaryText =
      parts[0] + (parts.length > 1 ? `.${parts.slice(1).join('')}` : '');

    // Format with commas for the display
    const formatted =
      parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
      (parts.length > 1 ? `.${parts.slice(1).join('')}` : '');

    setDisplayValue(formatted);
    const num = Number.parseFloat(sanitaryText);
    onChange(Number.isNaN(num) ? 0 : num);
  };

  return (
    <View
      style={[
        {
          backgroundColor: colors.inputBg,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: 12,
        },
      ]}
    >
      <Text
        style={{ color: colors.textSecondary, marginRight: 4, fontSize: 16 }}
      >
        {currencySymbol}
      </Text>
      <TextInput
        style={{
          flex: 1,
          color: colors.text,
          height: '100%',
          fontSize: 16,
        }}
        value={displayValue}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
      />
    </View>
  );
};

export default function ProductEditScreen() {
  const rawParams = useLocalSearchParams<{ id: string; sku?: string }>();
  const { colors } = useTheme();
  const { merchant, isLoading } = useMerchant();
  const router = useRouter();

  // Validate route params with Zod
  const validatedParams = (() => {
    const result = routeParamsSchema.safeParse(rawParams);
    return result.success ? result.data : null;
  })();

  // Extract id safely (will be undefined if validation fails)
  const id = validatedParams?.id;
  const isEditing = id !== 'new' && id !== undefined;
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);

  const generateSKU = () => {
    return `SKU-${Crypto.randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    sku: isEditing ? '' : rawParams.sku || generateSKU(),
    price: 0,
    cost_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 3,
    description: '',
    category: '',
    category_id: '',
    color: '',
    variant_attributes: [] as Array<{ key: string; value: string }>,
    fulfillment_details: {
      items: [] as Array<{ imei: string; serial_number: string }>,
    },
    images: [] as string[],
    manage_stock: true,
    status: 'active' as 'active' | 'draft' | 'archived',
  });

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isFulfillmentModalVisible, setIsFulfillmentModalVisible] =
    useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const { data: categories = [] } = useCategories();

  // Create Category Mutation
  const createCategoryMutation = useCreateCategory();

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    createCategoryMutation.mutate(newCategoryName, {
      onSuccess: (newCategory) => {
        // Auto-select the new category
        setFormData((prev) => ({
          ...prev,
          category: newCategory.name,
          category_id: newCategory.id,
        }));
        setNewCategoryName('');
        setIsCreatingCategory(false);
        setIsCategoryModalVisible(false); // Optional: close modal or just keep open with selection
        Alert.alert('Success', 'Category created and selected');
      },
      onError: (err) => {
        Alert.alert('Error', err.message);
      },
    });
  };

  // Fetch product details using the new hook
  // Pass 'new' for invalid/undefined id - the hook handles this by returning null
  const { data: product, error } = useProduct(id ?? 'new');

  const [isInitialized, setIsInitialized] = useState(false);

  // Update local state when data is fetched
  // 2026 Best Practice: Prevent background refetches from overwriting user input by only initializing once.
  useEffect(() => {
    if (product && !isInitialized) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        price: product.price || 0,
        cost_price: product.cost_price || 0,
        stock_quantity: product.stock_quantity || 0,
        low_stock_threshold: product.low_stock_threshold || 3,
        description: stripHtmlTags(product.description || ''),
        category: product.category || '',
        category_id: product.category_id || '',
        color: product.color || '',
        variant_attributes: product.variant_attributes
          ? Object.entries(
              product.variant_attributes as Record<string, unknown>
            ).map(([key, value]) => ({
              key,
              value: String(value),
            }))
          : [],
        fulfillment_details:
          product.fulfillment_details &&
          typeof product.fulfillment_details === 'object' &&
          'items' in product.fulfillment_details
            ? (product.fulfillment_details as {
                items: Array<{ imei: string; serial_number: string }>;
              })
            : {
                items: Array.from(
                  { length: product.stock_quantity || 0 },
                  () => ({
                    imei: '',
                    serial_number: '',
                  })
                ),
              },
        images: (product.images as string[]) || [],
        manage_stock: product.manage_stock ?? true,
        status: (product.status as 'active' | 'draft' | 'archived') || 'active',
      });
      setIsInitialized(true);
    }
  }, [product, isInitialized]);

  // Use centralized hooks
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

  // Show error screen for invalid route params (after all hooks)
  if (!validatedParams || !id) {
    return (
      <InvalidRouteScreen
        title="Invalid Product"
        message="The product ID is invalid. Please check the link and try again."
      />
    );
  }

  const handleSave = async () => {
    if (
      saveInFlightRef.current ||
      updateProductMutation.isPending ||
      createProductMutation.isPending
    ) {
      return;
    }

    if (!formData.name?.trim()) {
      Alert.alert('Validation Error', 'Product name is required');
      return;
    }
    if (
      formData.price === undefined ||
      formData.price === null ||
      formData.price < 0
    ) {
      Alert.alert('Validation Error', 'Please enter a valid price');
      return;
    }

    // Check for duplicate attribute keys (they collapse into one after save+reload)
    const attrKeys = formData.variant_attributes
      .map((a) => a.key.trim().toLowerCase())
      .filter(Boolean);
    const uniqueKeys = new Set(attrKeys);
    if (uniqueKeys.size < attrKeys.length) {
      Alert.alert(
        'Duplicate Attributes',
        'Each attribute key must be unique. Please remove or rename duplicate keys.'
      );
      return;
    }

    const payload = { ...formData };

    if (!isEditing && exactProductSuggestion) {
      Alert.alert(
        'Existing product found',
        `"${exactProductSuggestion.name}" already exists. Open it instead of creating a duplicate product.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open product',
            onPress: () => router.push(`/product/${exactProductSuggestion.id}`),
          },
        ]
      );
      return;
    }

    try {
      await runSingleFlight(saveInFlightRef, async () => {
        if (isEditing) {
          await updateProductMutation.mutateAsync({ id, updates: payload });
          Alert.alert('Success', 'Product updated successfully');
          router.back();
          return;
        }

        await createProductMutation.mutateAsync(payload);
        Alert.alert('Success', 'Product created successfully');
        router.back();
      });
    } catch (err: unknown) {
      Alert.alert('Error', (err as Error).message);
    }
  };

  const adjustStock = (newQuantity: number) => {
    const newStock = Math.max(0, newQuantity);

    // Sync fulfillment items array size
    const currentItems = formData.fulfillment_details.items || [];
    let newItems = [...currentItems];

    if (newStock > currentItems.length) {
      // Add empty items
      const itemsToAdd = newStock - currentItems.length;
      newItems = [
        ...newItems,
        ...Array.from({ length: itemsToAdd }, () => ({
          imei: '',
          serial_number: '',
        })),
      ];
    } else if (newStock < currentItems.length) {
      // Remove last items
      newItems = newItems.slice(0, newStock);
    }

    setFormData({
      ...formData,
      stock_quantity: newStock,
      fulfillment_details: { items: newItems },
    });
  };

  const updateFulfillmentItem = (
    index: number,
    field: 'imei' | 'serial_number',
    value: string
  ) => {
    const newItems = [...(formData.fulfillment_details.items || [])];
    if (!newItems[index]) newItems[index] = { imei: '', serial_number: '' };
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({
      ...formData,
      fulfillment_details: { items: newItems },
    });
  };

  const addAttribute = () => {
    setFormData({
      ...formData,
      variant_attributes: [
        ...formData.variant_attributes,
        { key: '', value: '' },
      ],
    });
  };

  const updateAttribute = (
    index: number,
    field: 'key' | 'value',
    text: string
  ) => {
    const newAttrs = [...formData.variant_attributes];
    newAttrs[index] = { ...newAttrs[index], [field]: text };
    setFormData({ ...formData, variant_attributes: newAttrs });
  };

  const removeAttribute = (index: number) => {
    const newAttrs = [...formData.variant_attributes];
    newAttrs.splice(index, 1);
    setFormData({ ...formData, variant_attributes: newAttrs });
  };

  const handleImagePick = async () => {
    Alert.alert('Upload Image', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permission Denied',
              'Camera permission is required to take photos.'
            );
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'], // Use the string literal directly if Typescript complains about ImagePicker.MediaTypeOptions
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

          if (!result.canceled && result.assets && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });

          if (!result.canceled && result.assets && result.assets[0]) {
            await uploadImage(result.assets[0].uri);
          }
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const uploadImage = async (uri: string) => {
    if (!merchant?.id) return;
    setIsUploading(true);

    try {
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${merchant.id}/products/${fileName}`;

      // Use FormData for reliable file upload in React Native
      const fileData = new FormData();
      fileData.append('file', {
        uri,
        name: fileName,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      } as unknown as Blob);

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, fileData, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('media').getPublicUrl(filePath);

      // Append new image to existing images
      setFormData({
        ...formData,
        images: [...(formData.images || []), publicUrl],
      });
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Upload error:', err);
      Alert.alert('Error', err.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const calculateProfitMargin = (price: number, costPrice: number) => {
    if (!costPrice || costPrice <= 0) {
      return {
        profit: 0,
        percentage: '0.0%',
        color: colors.textSecondary,
        active: false,
      };
    }
    const profit = price - costPrice;
    const percentage =
      price > 0 ? `${((profit / price) * 100).toFixed(1)}%` : '0.0%';
    const color =
      profit > 0
        ? colors.success
        : profit < 0
          ? colors.error
          : colors.textSecondary;
    return { profit, percentage, color, active: true };
  };

  if (isLoading) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <Text style={{ color: colors.text }}>Error loading product</Text>
        <Text style={{ color: colors.textSecondary }}>{error.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['bottom']}
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => {
                void handleSave();
              }}
              disabled={
                updateProductMutation.isPending ||
                createProductMutation.isPending
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.6 : 1,
                flexDirection: 'row',
                alignItems: 'center',
              })}
            >
              {(updateProductMutation.isPending ||
                createProductMutation.isPending) && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginRight: 8 }}
                />
              )}
              <Text
                style={{
                  color: colors.primary,
                  fontSize: 17,
                  fontWeight: '600',
                }}
              >
                Save
              </Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        {/* Product Image */}
        <Pressable
          style={[
            styles.imageContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={handleImagePick}
          disabled={isUploading}
          accessibilityRole="button"
          accessibilityLabel="Product image"
          accessibilityHint="Double tap to upload or change product image"
        >
          {isUploading ? (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : formData.images && formData.images.length > 0 ? (
            <View>
              <SafeImage
                source={{ uri: formData.images[0] }}
                style={styles.productImage}
                contentFit="cover"
                transition={200}
              />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={24} color="#FFF" />
                <Text style={styles.imageOverlayText}>Change Image</Text>
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                { backgroundColor: colors.inputBg },
              ]}
            >
              <Ionicons
                name="image-outline"
                size={48}
                color={colors.textSecondary}
              />
              <Text style={[styles.imageText, { color: colors.textSecondary }]}>
                Tap to upload image
              </Text>
            </View>
          )}
        </Pressable>

        {/* Status / Visibility */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            },
          ]}
        >
          <View>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.text, marginBottom: 4 },
              ]}
            >
              Product Status
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              {formData.status === 'active'
                ? 'Product is visible to customers.'
                : 'Product is hidden from store.'}
            </Text>
          </View>
          <Switch
            value={formData.status === 'active'}
            disabled={updateStatusMutation.isPending}
            onValueChange={(val) => {
              const newStatus = val ? 'active' : 'draft';
              const previousStatus = formData.status;
              setFormData((prev) => ({ ...prev, status: newStatus }));
              // Autosave status change immediately if editing
              if (isEditing) {
                updateStatusMutation.mutate(
                  { productId: id, status: newStatus },
                  {
                    onError: (error) => {
                      // Rollback to previous status on error
                      setFormData((prev) => ({
                        ...prev,
                        status: previousStatus,
                      }));
                      const message =
                        error instanceof Error
                          ? error.message
                          : 'Failed to update product status';
                      Alert.alert('Update Failed', message);
                    },
                  }
                );
              }
            }}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>

        {/* Basic Info */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Basic Information
          </Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Product Name <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter product name"
            placeholderTextColor={colors.textSecondary}
          />
          {!isEditing ? (
            <ExistingProductSuggestions
              colors={colors}
              suggestions={productNameSuggestions}
              onOpenProduct={(productId) =>
                router.push(`/product/${productId}`)
              }
            />
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            SKU <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={formData.sku}
            onChangeText={(text) => setFormData({ ...formData, sku: text })}
            placeholder="Enter SKU"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Category <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <Pressable
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              },
            ]}
            onPress={() => setIsCategoryModalVisible(true)}
          >
            <Text
              style={{
                color: formData.category_id
                  ? colors.text
                  : colors.textSecondary,
              }}
            >
              {categories.find((c) => c.id === formData.category_id)?.name ||
                formData.category ||
                'Select Category'}
            </Text>
            <Ionicons
              name="chevron-down"
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Color
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
            placeholder="e.g. Midnight Blue"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Description
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.inputBg,
                color: colors.text,
                borderColor: colors.border,
              },
            ]}
            value={formData.description}
            onChangeText={(text) =>
              setFormData({ ...formData, description: text })
            }
            placeholder="Enter product description"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Variants Section - Only if Parent */}
        {product?.variants && product.variants.length > 0 ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.text, marginBottom: 0 },
                ]}
              >
                Variants
              </Text>
              <View
                style={{
                  backgroundColor: colors.inputBg,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 12,
                }}
              >
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {product.variants.length} Items
                </Text>
              </View>
            </View>
            <Text
              style={{
                color: colors.textSecondary,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              This is a parent product. Manage stock, pricing, and specific
              attributes on the individual variants below.
            </Text>

            {product.variants.map((variant) => (
              <Pressable
                key={variant.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
                onPress={() => router.push(`/product/${variant.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '600',
                      fontSize: 15,
                    }}
                  >
                    {variant.variant_attributes
                      ? Object.values(variant.variant_attributes).join(' / ')
                      : variant.name}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12,
                      marginTop: 2,
                    }}
                  >
                    {variant.sku || 'No SKU'} • Stock:{' '}
                    {variant.stock_quantity || 0}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            {/* Attributes Section - Only if NOT a parent with existing variants */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 16,
                }}
              >
                <Text
                  style={[
                    styles.cardTitle,
                    { color: colors.text, marginBottom: 0 },
                  ]}
                >
                  Attributes
                </Text>
                <Pressable
                  onPress={addAttribute}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                >
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text
                    style={{
                      color: colors.primary,
                      marginLeft: 4,
                      fontWeight: '600',
                    }}
                  >
                    Add
                  </Text>
                </Pressable>
              </View>
              {formData.variant_attributes.length === 0 && (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  No attributes defined (e.g. Storage, RAM).
                </Text>
              )}
              {formData.variant_attributes.map((attr, index) => (
                <View key={index} style={[styles.row, { marginBottom: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      value={attr.key}
                      onChangeText={(text) =>
                        updateAttribute(index, 'key', text)
                      }
                      placeholder="Key (e.g. Storage)"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.text,
                          borderColor: colors.border,
                        },
                      ]}
                      value={attr.value}
                      onChangeText={(text) =>
                        updateAttribute(index, 'value', text)
                      }
                      placeholder="Value (e.g. 256GB)"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <Pressable
                    onPress={() => removeAttribute(index)}
                    style={{ justifyContent: 'center', paddingHorizontal: 8 }}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Pricing - Show for single variants */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Pricing
              </Text>
              <View style={styles.row}>
                <View style={[styles.halfInput, { marginRight: 8 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Selling Price <Text style={{ color: colors.error }}>*</Text>
                  </Text>
                  <PriceInput
                    value={formData.price}
                    onChange={(val) => setFormData({ ...formData, price: val })}
                    placeholder="0.00"
                    colors={colors}
                    currencySymbol={currencySymbol}
                  />
                </View>
                <View style={[styles.halfInput, { marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Cost Price
                  </Text>
                  <PriceInput
                    value={formData.cost_price}
                    onChange={(val) =>
                      setFormData({ ...formData, cost_price: val })
                    }
                    placeholder="0.00"
                    colors={colors}
                    currencySymbol={currencySymbol}
                  />
                </View>
              </View>
              {/* Profit Margin Calculation */}
              <View
                style={[styles.profitCard, { backgroundColor: colors.inputBg }]}
              >
                <Text
                  style={[styles.profitLabel, { color: colors.textSecondary }]}
                >
                  Profit Margin
                </Text>
                {calculateProfitMargin(formData.price, formData.cost_price)
                  .active ? (
                  <Text
                    style={[
                      styles.profitValue,
                      {
                        color: calculateProfitMargin(
                          formData.price,
                          formData.cost_price
                        ).color,
                      },
                    ]}
                  >
                    {currencySymbol}
                    {new Intl.NumberFormat().format(
                      formData.price - formData.cost_price
                    )}{' '}
                    (
                    {
                      calculateProfitMargin(formData.price, formData.cost_price)
                        .percentage
                    }
                    )
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.profitValue,
                      {
                        color: colors.textSecondary,
                        fontSize: 13,
                        fontWeight: '500',
                        marginTop: 4,
                      },
                    ]}
                  >
                    Enter cost price to calculate margin
                  </Text>
                )}
              </View>
            </View>

            {/* Inventory Tracking Toggle */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cardTitle,
                    { marginBottom: 4, color: colors.text },
                  ]}
                >
                  Track Inventory
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Automatically manage stock levels and fulfillments.
                </Text>
              </View>
              <Switch
                value={formData.manage_stock}
                onValueChange={(value) =>
                  setFormData({ ...formData, manage_stock: value })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={
                  Platform.OS === 'ios'
                    ? undefined
                    : formData.manage_stock
                      ? colors.primary
                      : '#f4f3f4'
                }
              />
            </View>

            {/* Fulfillment - Show only if tracking inventory */}
            {formData.manage_stock && (
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={[styles.row, { marginBottom: 16 }]}>
                  <View>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: colors.text, marginBottom: 4 },
                      ]}
                    >
                      Fulfillment Details
                    </Text>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        maxWidth: '90%',
                      }}
                    >
                      Manage unique identifiers (IMEI, S/N).
                    </Text>
                  </View>
                  <Ionicons
                    name="barcode-outline"
                    size={24}
                    color={colors.primary}
                  />
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <View>
                    <Text
                      style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: '600',
                      }}
                    >
                      {formData.fulfillment_details.items.length} Units
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Needs {formData.stock_quantity} identifiers
                    </Text>
                  </View>
                  <Pressable
                    style={{
                      backgroundColor: colors.primary,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                    onPress={() => setIsFulfillmentModalVisible(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>
                      {formData.fulfillment_details.items.length > 0
                        ? 'View/Edit Items'
                        : 'Add Details'}
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginVertical: 16,
                  }}
                />

                <View>
                  <Text
                    style={[
                      styles.cardTitle,
                      { color: colors.text, fontSize: 16 },
                    ]}
                  >
                    Stock Management
                  </Text>
                  <View style={styles.stockRow}>
                    <View style={styles.stockInfo}>
                      <Text
                        style={[
                          styles.stockLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Quantity <Text style={{ color: colors.error }}>*</Text>
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBg,
                            color: colors.text,
                            borderColor: colors.border,
                            width: 120,
                            textAlign: 'center',
                          },
                        ]}
                        value={
                          formData.stock_quantity === 0
                            ? ''
                            : new Intl.NumberFormat().format(
                                formData.stock_quantity
                              )
                        }
                        onChangeText={(text) => {
                          const num = Number.parseInt(
                            text.replace(/,/g, ''),
                            10
                          );
                          adjustStock(Number.isNaN(num) ? 0 : num);
                        }}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.stockActions}>
                      <Pressable
                        style={[
                          styles.stockButton,
                          { backgroundColor: colors.error },
                        ]}
                        onPress={() => adjustStock(formData.stock_quantity - 1)}
                      >
                        <Ionicons name="remove" size={20} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        style={[
                          styles.stockButton,
                          { backgroundColor: colors.success },
                        ]}
                        onPress={() => adjustStock(formData.stock_quantity + 1)}
                      >
                        <Ionicons name="add" size={20} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 12,
                    }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      Low Stock Threshold
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.inputBg,
                          color: colors.text,
                          borderColor: colors.border,
                          width: 80,
                          padding: 8,
                          textAlign: 'center',
                        },
                      ]}
                      value={formData.low_stock_threshold?.toString()}
                      onChangeText={(text) =>
                        setFormData({
                          ...formData,
                          low_stock_threshold: Number(text) || 0,
                        })
                      }
                      keyboardType="numeric"
                      placeholder="3"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* Save Button removed - moved to Header */}
      </ScrollView>

      {/* Category Modal */}
      <Modal
        visible={isCategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsCategoryModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsCategoryModalVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Category
              </Text>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              >
                <Pressable
                  onPress={() => setIsCreatingCategory(!isCreatingCategory)}
                  style={{
                    backgroundColor: isCreatingCategory
                      ? colors.error + '15'
                      : `${colors.primary}15`,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 20,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={isCreatingCategory ? 'close' : 'add'}
                    size={20}
                    color={isCreatingCategory ? colors.error : colors.primary}
                  />
                  <Text
                    style={{
                      color: isCreatingCategory ? colors.error : colors.primary,
                      fontWeight: '700',
                      fontSize: 14,
                    }}
                  >
                    {isCreatingCategory ? 'Cancel' : 'Add New'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setIsCategoryModalVisible(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {isCreatingCategory && (
              <View style={{ marginBottom: 16, flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                      borderColor: colors.border,
                    },
                  ]}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  placeholder="New Category Name"
                  placeholderTextColor={colors.textSecondary}
                />
                <Pressable
                  style={{
                    backgroundColor: colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    borderRadius: 8,
                  }}
                  onPress={handleCreateCategory}
                  disabled={createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>
                      Add
                    </Text>
                  )}
                </Pressable>
              </View>
            )}

            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.categoryItem,
                    { borderBottomColor: colors.border },
                  ]}
                  onPress={() => {
                    setFormData({
                      ...formData,
                      category: item.name,
                      category_id: item.id,
                    });
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Text
                    style={[styles.categoryItemText, { color: colors.text }]}
                  >
                    {item.name}
                  </Text>
                  {formData.category_id === item.id && (
                    <Ionicons name="checkmark" size={20} color={colors.text} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Fulfillment Modal */}
      <Modal
        visible={isFulfillmentModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsFulfillmentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, height: '80%' },
            ]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Fulfillment Details
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Enter details for {formData.stock_quantity} units
                </Text>
              </View>
              <Pressable onPress={() => setIsFulfillmentModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <FlatList
              data={formData.fulfillment_details.items}
              keyExtractor={(_, index) => index.toString()}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item, index }) => (
                <View
                  style={{
                    marginBottom: 20,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                    paddingBottom: 16,
                  }}
                >
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: '700',
                      marginBottom: 8,
                    }}
                  >
                    Item #{index + 1}
                  </Text>

                  <View style={{ gap: 12 }}>
                    <View>
                      <Text
                        style={[
                          styles.label,
                          { color: colors.textSecondary, marginTop: 0 },
                        ]}
                      >
                        IMEI
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBg,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        value={item.imei}
                        onChangeText={(text) =>
                          updateFulfillmentItem(index, 'imei', text)
                        }
                        placeholder="Enter IMEI"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.label,
                          { color: colors.textSecondary, marginTop: 0 },
                        ]}
                      >
                        Serial Number
                      </Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: colors.inputBg,
                            color: colors.text,
                            borderColor: colors.border,
                          },
                        ]}
                        value={item.serial_number}
                        onChangeText={(text) =>
                          updateFulfillmentItem(index, 'serial_number', text)
                        }
                        placeholder="Enter Serial Number"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              )}
            />

            <Pressable
              style={[styles.saveButton, { marginTop: 16, marginBottom: 0 }]}
              onPress={() => setIsFulfillmentModalVisible(false)}
            >
              <Text style={styles.saveButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  imageContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageText: {
    fontSize: 14,
    fontWeight: '500',
  },
  productImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    padding: 12,
    borderRadius: 8,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  profitCard: {
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  profitLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  profitValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 4,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  stockInfo: {},
  stockLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  stockValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  stockActions: {
    flexDirection: 'row',
    gap: 8,
  },
  stockButton: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  categoryItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryItemText: {
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
