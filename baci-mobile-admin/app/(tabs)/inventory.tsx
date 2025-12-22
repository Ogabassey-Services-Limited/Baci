/**
 * Inventory Screen - Product and Stock Management
 * Includes barcode scanning for quick updates
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockThreshold: number;
  image?: string;
}

// Mock data
const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'iPhone 15 Pro Max', sku: 'IPH15PM-256', price: 1850000, stock: 5, lowStockThreshold: 3 },
  { id: '2', name: 'Samsung Galaxy S24', sku: 'SGS24-128', price: 950000, stock: 12, lowStockThreshold: 5 },
  { id: '3', name: 'MacBook Air M3', sku: 'MBA-M3-256', price: 1450000, stock: 2, lowStockThreshold: 3 },
  { id: '4', name: 'AirPods Pro 2', sku: 'APP2-USB-C', price: 185000, stock: 25, lowStockThreshold: 10 },
];

export default function InventoryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
    inputBg: isDark ? '#1E293B' : '#F1F5F9',
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const filteredProducts = MOCK_PRODUCTS.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderProduct = ({ item }: { item: Product }) => {
    const isLowStock = item.stock <= item.lowStockThreshold;
    const isOutOfStock = item.stock === 0;

    return (
      <Pressable
        style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push(`/product/${item.id}`)}
      >
        <View style={[styles.productImage, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="cube-outline" size={32} color={colors.textSecondary} />
        </View>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.productSku, { color: colors.textSecondary }]}>{item.sku}</Text>
          <Text style={[styles.productPrice, { color: colors.text }]}>{formatPrice(item.price)}</Text>
        </View>
        <View style={styles.stockInfo}>
          <View
            style={[
              styles.stockBadge,
              {
                backgroundColor: isOutOfStock
                  ? '#FEE2E2'
                  : isLowStock
                  ? '#FEF3C7'
                  : '#D1FAE5',
              },
            ]}
          >
            <Text
              style={[
                styles.stockText,
                {
                  color: isOutOfStock ? '#DC2626' : isLowStock ? '#D97706' : '#059669',
                },
              ]}
            >
              {item.stock}
            </Text>
          </View>
          <Text style={[styles.stockLabel, { color: colors.textSecondary }]}>in stock</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchInputWrapper, { backgroundColor: colors.inputBg }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products or SKU..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Pressable
          style={[styles.scanButton, { backgroundColor: '#3B82F6' }]}
          onPress={() => router.push('/scan')}
        >
          <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{MOCK_PRODUCTS.length}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Products</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: '#D97706' }]}>
            {MOCK_PRODUCTS.filter((p) => p.stock <= p.lowStockThreshold && p.stock > 0).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Low Stock</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.statValue, { color: '#DC2626' }]}>
            {MOCK_PRODUCTS.filter((p) => p.stock === 0).length}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Out of Stock</Text>
        </View>
      </View>

      {/* Products List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#3B82F6" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  scanButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  productCard: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
  },
  productSku: {
    fontSize: 12,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  stockInfo: {
    alignItems: 'center',
  },
  stockBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 40,
    alignItems: 'center',
  },
  stockText: {
    fontSize: 16,
    fontWeight: '800',
  },
  stockLabel: {
    fontSize: 10,
    marginTop: 4,
  },
});
