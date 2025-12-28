/**
 * Analytics Screen - Business Insights Dashboard
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const colors = {
    background: isDark ? '#0F172A' : '#F8FAFC',
    card: isDark ? '#1E293B' : '#FFFFFF',
    text: isDark ? '#F8FAFC' : '#0F172A',
    textSecondary: isDark ? '#94A3B8' : '#64748B',
    border: isDark ? '#334155' : '#E2E8F0',
  };

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Revenue Card */}
        <View style={[styles.revenueCard, { backgroundColor: '#3B82F6' }]}>
          <Text style={styles.revenueLabel}>Today's Revenue</Text>
          <Text style={styles.revenueValue}>{formatPrice(450000)}</Text>
          <View style={styles.revenueChange}>
            <Ionicons name="trending-up" size={16} color="#10B981" />
            <Text style={styles.revenueChangeText}>+12.5% vs yesterday</Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="cart-outline" size={24} color="#3B82F6" />
            <Text style={[styles.statValue, { color: colors.text }]}>24</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Orders Today</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={24} color="#8B5CF6" />
            <Text style={[styles.statValue, { color: colors.text }]}>156</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Customers</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="cube-outline" size={24} color="#10B981" />
            <Text style={[styles.statValue, { color: colors.text }]}>89</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Products Sold</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="star-outline" size={24} color="#F59E0B" />
            <Text style={[styles.statValue, { color: colors.text }]}>4.8</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Avg Rating</Text>
          </View>
        </View>

        {/* Top Products */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Selling Products</Text>
          {[
            { name: 'iPhone 15 Pro Max', sold: 15, revenue: 27750000 },
            { name: 'AirPods Pro 2', sold: 28, revenue: 5180000 },
            { name: 'Samsung Galaxy S24', sold: 12, revenue: 11400000 },
          ].map((product, index) => (
            <View key={index} style={[styles.productRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.productRank, { color: colors.textSecondary }]}>#{index + 1}</Text>
              <View style={styles.productDetails}>
                <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                <Text style={[styles.productSold, { color: colors.textSecondary }]}>{product.sold} sold</Text>
              </View>
              <Text style={[styles.productRevenue, { color: colors.text }]}>{formatPrice(product.revenue)}</Text>
            </View>
          ))}
        </View>
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
  revenueCard: {
    padding: 20,
    borderRadius: 16,
  },
  revenueLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  revenueValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginVertical: 8,
  },
  revenueChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  revenueChangeText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
  },
  section: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  productRank: {
    fontSize: 14,
    fontWeight: '600',
    width: 30,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
  },
  productSold: {
    fontSize: 12,
    marginTop: 2,
  },
  productRevenue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
