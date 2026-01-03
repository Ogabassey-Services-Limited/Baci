/**
 * Categories Screen
 * Browse products by category
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import Colors, { BRAND, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useCategories } from '@/hooks/use-products-query';

export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const { data: categories = [], isLoading } = useCategories();

  const handleCategoryPress = (slug: string) => {
    router.push(`/category/${slug}` as any);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={BRAND.primary} />
      </View>
    );
  }

  const renderCategory = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        styles.categoryCard,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && styles.categoryPressed,
      ]}
      onPress={() => handleCategoryPress(item.slug)}
      accessibilityLabel={`Browse ${item.name}`}
      accessibilityRole="button"
    >
      <Image
        source={{ uri: item.image_url || 'https://placehold.co/400x400/f8fafc/94a3b8?text=No+Image' }}
        style={styles.categoryImage}
        contentFit="cover"
        transition={300}
      />
      <View style={styles.categoryInfo}>
        <Text style={[styles.categoryName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
          Explore collection
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: SPACING.md,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
  },
  categoryPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  categoryImage: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.lg,
    backgroundColor: '#F3F4F6',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 16,
  },
  categoryName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  separator: {
    height: 12,
  },
});
