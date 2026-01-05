/**
 * Product Edit Screen
 * Manage product details and inventory
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Modal,
  FlatList,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCategories, useProduct } from '@/hooks/useProducts';
import { useMerchant } from '@/hooks/useMerchant';
import * as ImagePicker from 'expo-image-picker';

// Helper to get currency symbol
const getCurrencySymbol = (currencyCode: string | null | undefined) => {
  const symbols: Record<string, string> = {
    'NGN': '₦',
    'USD': '$',
    'GBP': '£',
    'EUR': '€',
  };
  return symbols[currencyCode || 'NGN'] || '₦';
};

// Formatted Price Input Component
const PriceInput = ({
  value,
  onChange,
  placeholder,
  colors,
  styles,
  currencySymbol
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder: string;
  colors: any;
  styles: any;
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
    // Allow digits and one decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');

    // Prevent multiple decimals
    const parts = cleaned.split('.');
    const sanitaryText = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');

    setDisplayValue(sanitaryText);
    const num = parseFloat(sanitaryText);
    onChange(isNaN(num) ? 0 : num);
  };

  return (
    <View style={[styles.input, {
      backgroundColor: colors.inputBg,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 12
    }]}>
      <Text style={{ color: colors.textSecondary, marginRight: 4, fontSize: 16 }}>{currencySymbol}</Text>
      <TextInput
        style={{
          flex: 1,
          color: colors.text,
          height: '100%',
          fontSize: 16
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const isEditing = id !== 'new';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();
  const { merchant } = useMerchant();
  const currencySymbol = getCurrencySymbol(merchant?.payout_currency);
  const router = useRouter(); // Use useRouter instead of router

  const generateSKU = () => {
    return `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
    inputBg: isDark ? '#1E293B' : '#F1F5F9',
  };

  const [formData, setFormData] = useState({
    name: '',
    sku: isEditing ? '' : generateSKU(),
    price: 0,
    cost_price: 0,
    stock_quantity: 0,
    low_stock_threshold: 3,
    description: '',
    category: '',
    category_id: '',
    color: '',
    variant_attributes: [] as Array<{ key: string; value: string }>,
    fulfillment_details: { items: [] as Array<{ imei: string; serial_number: string }> },
    images: [] as string[],
  });

  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [isFulfillmentModalVisible, setIsFulfillmentModalVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { data: categories = [] } = useCategories();

  // Fetch product details using the new hook
  const { data: product, isLoading, error, refetch } = useProduct(id);

  // Helper to strip HTML tags
  const stripHtml = (html: string) => {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
  };

  // Update local state when data is fetched
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        sku: product.sku || '',
        price: product.price || 0,
        cost_price: product.cost_price || 0,
        stock_quantity: product.stock_quantity || 0,
        low_stock_threshold: product.low_stock_threshold || 3,
        description: stripHtml(product.description || ''),
        category: product.category || '',
        category_id: product.category_id || '',
        color: product.color || '',
        variant_attributes: product.variant_attributes
          ? Object.entries(product.variant_attributes).map(([key, value]) => ({ key, value: String(value) }))
          : [],
        fulfillment_details: product.fulfillment_details?.items
          ? product.fulfillment_details
          : { items: Array(product.stock_quantity || 0).fill({ imei: '', serial_number: '' }) },
        images: product.images || [],
      });
    }
  }, [product]);

  // Update mutation
  const updateProductMutation = useMutation({
    mutationFn: async (updates: typeof formData) => {
      const { error } = await supabase
        .from('products')
        .update({
          ...updates,
          variant_attributes: updates.variant_attributes.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
          }, {} as Record<string, any>)
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Refresh list
      Alert.alert('Success', 'Product updated successfully');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err.message);
    },
  });

  // Create mutation
  const createProductMutation = useMutation({
    mutationFn: async (newProduct: typeof formData) => {
      const { error } = await supabase
        .from('products')
        .insert([{
          ...newProduct,
          merchant_id: merchant?.id, // Ensure merchant_id is passed
          variant_attributes: newProduct.variant_attributes.reduce((acc, curr) => {
            if (curr.key) acc[curr.key] = curr.value;
            return acc;
          }, {} as Record<string, any>)
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      Alert.alert('Success', 'Product created successfully');
      router.back();
    },
    onError: (err) => {
      Alert.alert('Error', err.message);
    },
  });

  const handleSave = () => {
    if (isEditing) {
      updateProductMutation.mutate(formData);
    } else {
      createProductMutation.mutate(formData);
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
      newItems = [...newItems, ...Array(itemsToAdd).fill({ imei: '', serial_number: '' })];
    } else if (newStock < currentItems.length) {
      // Remove last items
      newItems = newItems.slice(0, newStock);
    }

    setFormData({
      ...formData,
      stock_quantity: newStock,
      fulfillment_details: { items: newItems }
    });
  };

  const updateFulfillmentItem = (index: number, field: 'imei' | 'serial_number', value: string) => {
    const newItems = [...(formData.fulfillment_details.items || [])];
    if (!newItems[index]) newItems[index] = { imei: '', serial_number: '' };
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({
      ...formData,
      fulfillment_details: { items: newItems }
    });
  };

  const addAttribute = () => {
    setFormData({
      ...formData,
      variant_attributes: [...formData.variant_attributes, { key: '', value: '' }]
    });
  };

  const updateAttribute = (index: number, field: 'key' | 'value', text: string) => {
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Pick image error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadImage = async (uri: string) => {
    if (!merchant?.id) return;
    setIsUploading(true);

    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `products/${Date.now()}.${fileExt}`; // Store in products folder
      const filePath = `${merchant.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, blob, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Update local state - replace existing or add new
      // Currently supporting single image for edit, so replace index 0
      setFormData({ ...formData, images: [publicUrl] });

    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('Error', error.message || 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const calculateProfitMargin = (price: number, costPrice: number) => {
    const profit = price - costPrice;
    const percentage = price > 0 ? ((profit / price) * 100).toFixed(1) + '%' : '0.0%';
    const color = profit > 0 ? '#10B981' : (profit < 0 ? '#EF4444' : colors.textSecondary);
    return { profit, percentage, color };
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Error loading product</Text>
        <Text style={{ color: colors.textSecondary }}>{error.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        {/* Product Image */}
        <Pressable
          style={[styles.imageContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleImagePick}
          disabled={isUploading}
        >
          {isUploading ? (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBg }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : formData.images && formData.images.length > 0 ? (
            <View>
              <Image source={{ uri: formData.images[0] }} style={styles.productImage} />
              <View style={styles.imageOverlay}>
                <Ionicons name="camera" size={24} color="#FFF" />
                <Text style={styles.imageOverlayText}>Change Image</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.imageText, { color: colors.textSecondary }]}>Tap to upload image</Text>
            </View>
          )}
        </Pressable>

        {/* Basic Info */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Basic Information</Text>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Product Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Enter product name"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>SKU</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={formData.sku}
            onChangeText={(text) => setFormData({ ...formData, sku: text })}
            placeholder="Enter SKU"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
          <Pressable
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
            onPress={() => setIsCategoryModalVisible(true)}
          >
            <Text style={{ color: formData.category_id ? colors.text : colors.textSecondary }}>
              {categories.find(c => c.id === formData.category_id)?.name || formData.category || 'Select Category'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
          </Pressable>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Color</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={formData.color}
            onChangeText={(text) => setFormData({ ...formData, color: text })}
            placeholder="e.g. Midnight Blue"
            placeholderTextColor={colors.textSecondary}
          />

          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border },
            ]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Enter product description"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Variants Section - Only if Parent */}
        {product?.variants && product.variants.length > 0 ? (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Variants</Text>
              <View style={{ backgroundColor: colors.inputBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>{product.variants.length} Items</Text>
              </View>
            </View>
            <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 13 }}>
              This is a parent product. Manage stock, pricing, and specific attributes on the individual variants below.
            </Text>

            {product.variants.map((variant: any) => (
              <Pressable
                key={variant.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.border
                }}
                onPress={() => router.push(`/product/${variant.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>
                    {variant.variant_attributes ? Object.values(variant.variant_attributes).join(' / ') : variant.name}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {variant.sku || 'No SKU'} • Stock: {variant.stock_quantity || 0}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        ) : (
          <>
            {/* Attributes Section - Only if NOT a parent with existing variants */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Attributes</Text>
                <Pressable onPress={addAttribute} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="add" size={20} color={colors.primary} />
                  <Text style={{ color: colors.primary, marginLeft: 4, fontWeight: '600' }}>Add</Text>
                </Pressable>
              </View>
              {formData.variant_attributes.length === 0 && (
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
                  No attributes defined (e.g. Storage, RAM).
                </Text>
              )}
              {formData.variant_attributes.map((attr, index) => (
                <View key={index} style={[styles.row, { marginBottom: 12 }]}>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                      value={attr.key}
                      onChangeText={(text) => updateAttribute(index, 'key', text)}
                      placeholder="Key (e.g. Storage)"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                      value={attr.value}
                      onChangeText={(text) => updateAttribute(index, 'value', text)}
                      placeholder="Value (e.g. 256GB)"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <Pressable onPress={() => removeAttribute(index)} style={{ justifyContent: 'center', paddingHorizontal: 8 }}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Pricing - Show for single variants */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Pricing</Text>
              <View style={styles.row}>
                <View style={[styles.halfInput, { marginRight: 8 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Selling Price</Text>
                  <PriceInput
                    value={formData.price}
                    onChange={(val) => setFormData({ ...formData, price: val })}
                    placeholder="0.00"
                    colors={colors}
                    styles={styles}
                    currencySymbol={currencySymbol}
                  />
                </View>
                <View style={[styles.halfInput, { marginLeft: 8 }]}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Cost Price</Text>
                  <PriceInput
                    value={formData.cost_price}
                    onChange={(val) => setFormData({ ...formData, cost_price: val })}
                    placeholder="0.00"
                    colors={colors}
                    styles={styles}
                    currencySymbol={currencySymbol}
                  />
                </View>
              </View>
              {/* Profit Margin Calculation */}
              <View style={[styles.profitCard, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Profit Margin</Text>
                <Text style={[styles.profitValue, { color: calculateProfitMargin(formData.price, formData.cost_price).color }]}>
                  {currencySymbol}{new Intl.NumberFormat().format(formData.price - formData.cost_price)} ({calculateProfitMargin(formData.price, formData.cost_price).percentage})
                </Text>
              </View>
            </View>

            {/* Fulfillment - Show for single variants */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.row, { marginBottom: 16 }]}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 4 }]}>Fulfillment Details</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13, maxWidth: '90%' }}>
                    Manage unique identifiers (IMEI, S/N).
                  </Text>
                </View>
                <Ionicons name="barcode-outline" size={24} color={colors.primary} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }}>
                    {formData.fulfillment_details.items.length} Units
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    Needs {formData.stock_quantity} identifiers
                  </Text>
                </View>
                <Pressable
                  style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}
                  onPress={() => setIsFulfillmentModalVisible(true)}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>
                    {formData.fulfillment_details.items.length > 0 ? 'View/Edit Items' : 'Add Details'}
                  </Text>
                </Pressable>
              </View>

              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 16 }} />

              <View>
                <Text style={[styles.cardTitle, { color: colors.text, fontSize: 16 }]}>Stock Management</Text>
                <View style={styles.stockRow}>
                  <View style={styles.stockInfo}>
                    <Text style={[styles.stockLabel, { color: colors.textSecondary }]}>Quantity</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, width: 100, textAlign: 'center' }]}
                      value={formData.stock_quantity.toString()}
                      onChangeText={(text) => adjustStock(parseInt(text) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.stockActions}>
                    <Pressable
                      style={[styles.stockButton, { backgroundColor: '#EF4444' }]}
                      onPress={() => adjustStock(formData.stock_quantity - 1)}
                    >
                      <Ionicons name="remove" size={20} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      style={[styles.stockButton, { backgroundColor: '#10B981' }]}
                      onPress={() => adjustStock(formData.stock_quantity + 1)}
                    >
                      <Ionicons name="add" size={20} color="#FFFFFF" />
                    </Pressable>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Low Stock Threshold</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border, width: 80, padding: 8, textAlign: 'center' }]}
                    value={formData.low_stock_threshold?.toString()}
                    onChangeText={(text) => setFormData({ ...formData, low_stock_threshold: Number(text) || 0 })}
                    keyboardType="numeric"
                    placeholder="3"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>
            </View>
          </>
        )}

        {/* Save Button */}
        <Pressable
          style={[styles.saveButton, { backgroundColor: updateProductMutation.isPending ? '#93C5FD' : '#3B82F6' }]}
          onPress={handleSave}
          disabled={updateProductMutation.isPending}
        >
          {updateProductMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>
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
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Category</Text>
              <Pressable onPress={() => setIsCategoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.categoryItem, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setFormData({ ...formData, category: item.name, category_id: item.id });
                    setIsCategoryModalVisible(false);
                  }}
                >
                  <Text style={[styles.categoryItemText, { color: colors.text }]}>{item.name}</Text>
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
          <View style={[styles.modalContent, { backgroundColor: colors.card, height: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Fulfillment Details</Text>
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
                <View style={{ marginBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 }}>
                  <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 8 }}>
                    Item #{index + 1}
                  </Text>

                  <View style={{ gap: 12 }}>
                    <View>
                      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>IMEI</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                        value={item.imei}
                        onChangeText={(text) => updateFulfillmentItem(index, 'imei', text)}
                        placeholder="Enter IMEI"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                    <View>
                      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 0 }]}>Serial Number</Text>
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                        value={item.serial_number}
                        onChangeText={(text) => updateFulfillmentItem(index, 'serial_number', text)}
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
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
});
