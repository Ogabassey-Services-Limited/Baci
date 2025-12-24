/**
 * Product Edit Screen
 * Manage product details and inventory
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost_price: number | null;
  stock: number;
  low_stock_threshold: number | null;
  description: string | null;
  category: string | null;
  images: any; // JSONB
};

type FormData = {
  id: string;
  name: string;
  sku: string;
  price: number;
  cost: number;
  stock: number;
  lowStockThreshold: number;
  description: string;
  category: string;
};

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    id: '',
    name: '',
    sku: '',
    price: 0,
    cost: 0,
    stock: 0,
    lowStockThreshold: 0,
    description: '',
    category: '',
  });

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
    inputBg: isDark ? '#1E293B' : '#F1F5F9',
  };

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Product;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (product) {
      setFormData({
        id: product.id,
        name: product.name || '',
        sku: product.sku || '',
        price: product.price || 0,
        cost: product.cost_price || 0,
        stock: product.stock || 0,
        lowStockThreshold: product.low_stock_threshold || 0,
        description: product.description || '',
        category: product.category || '',
      });
    }
  }, [product]);

  const updateProductMutation = useMutation({
    mutationFn: async (updatedData: FormData) => {
      const { error } = await supabase
        .from('products')
        .update({
          name: updatedData.name,
          sku: updatedData.sku,
          price: updatedData.price,
          cost_price: updatedData.cost,
          stock: updatedData.stock,
          low_stock_threshold: updatedData.lowStockThreshold,
          description: updatedData.description,
          category: updatedData.category, // Writing to text column as per UI
        })
        .eq('id', updatedData.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      queryClient.invalidateQueries({ queryKey: ['products'] }); // Assuming list key
      Alert.alert('Success', 'Product updated successfully');
      router.back();
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const handleSave = () => {
    if (!formData.id) return;
    updateProductMutation.mutate(formData);
  };

  const adjustStock = (delta: number) => {
    setFormData((prev) => ({
      ...prev,
      stock: Math.max(0, prev.stock + delta),
    }));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.text }}>Error loading product</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.textSecondary }}>Go Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Product Image */}
        <View style={[styles.imageContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="image-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.imageText, { color: colors.textSecondary }]}>Tap to upload image</Text>
          </View>
        </View>

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
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={formData.category}
            onChangeText={(text) => setFormData({ ...formData, category: text })}
            placeholder="Enter category"
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

        {/* Pricing */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Pricing</Text>

          <View style={styles.row}>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Cost Price</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={formData.cost.toString()}
                onChangeText={(text) => setFormData({ ...formData, cost: Number(text) || 0 })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            <View style={styles.halfWidth}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Selling Price</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                value={formData.price.toString()}
                onChangeText={(text) => setFormData({ ...formData, price: Number(text) || 0 })}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          </View>

          <View style={[styles.profitCard, { backgroundColor: colors.inputBg }]}>
            <Text style={[styles.profitLabel, { color: colors.textSecondary }]}>Profit Margin</Text>
            <Text style={[styles.profitValue, { color: '#10B981' }]}>
              ₦{(formData.price - formData.cost).toLocaleString()} (
              {formData.price > 0 ? (((formData.price - formData.cost) / formData.price) * 100).toFixed(1) : '0.0'}%)
            </Text>
          </View>
        </View>

        {/* Stock Management */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Stock Management</Text>

          <View style={styles.stockRow}>
            <View style={styles.stockInfo}>
              <Text style={[styles.stockLabel, { color: colors.textSecondary }]}>Current Stock</Text>
              <Text style={[styles.stockValue, { color: colors.text }]}>{formData.stock} units</Text>
            </View>
            <View style={styles.stockActions}>
              <Pressable
                style={[styles.stockButton, { backgroundColor: '#EF4444' }]}
                onPress={() => adjustStock(-1)}
              >
                <Ionicons name="remove" size={20} color="#FFFFFF" />
              </Pressable>
              <Pressable
                style={[styles.stockButton, { backgroundColor: '#10B981' }]}
                onPress={() => adjustStock(1)}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Low Stock Alert Threshold</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            value={formData.lowStockThreshold.toString()}
            onChangeText={(text) => setFormData({ ...formData, lowStockThreshold: Number(text) || 0 })}
            keyboardType="numeric"
            placeholder="3"
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Save Button */}
        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: '#3B82F6', opacity: updateProductMutation.isPending ? 0.7 : 1 },
          ]}
          onPress={handleSave}
          disabled={updateProductMutation.isPending}
        >
          {updateProductMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </Pressable>
      </ScrollView>
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
  halfWidth: {
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
});
