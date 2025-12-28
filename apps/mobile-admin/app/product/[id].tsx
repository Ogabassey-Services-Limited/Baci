/**
 * Product Edit Screen
 * Manage product details and inventory
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';

// Mock product data
const MOCK_PRODUCT = {
  id: '1',
  name: 'iPhone 15 Pro Max',
  sku: 'IPH15PM-256',
  price: 1850000,
  cost: 1600000,
  stock: 5,
  lowStockThreshold: 3,
  description: 'Latest iPhone with A17 Pro chip and titanium design',
  category: 'Smartphones',
};

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [formData, setFormData] = useState(MOCK_PRODUCT);

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
    inputBg: isDark ? '#1E293B' : '#F1F5F9',
  };

  const handleSave = () => {
    // TODO: Implement mutation to update product
    Alert.alert('Success', 'Product updated successfully');
    router.back();
  };

  const adjustStock = (delta: number) => {
    setFormData((prev) => ({
      ...prev,
      stock: Math.max(0, prev.stock + delta),
    }));
  };

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
              {(((formData.price - formData.cost) / formData.price) * 100).toFixed(1)}%)
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
        <Pressable style={[styles.saveButton, { backgroundColor: '#3B82F6' }]} onPress={handleSave}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
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
