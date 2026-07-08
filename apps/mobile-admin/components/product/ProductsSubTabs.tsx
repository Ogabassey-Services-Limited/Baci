import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RADIUS, SPACING, TYPOGRAPHY } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// Sub-tabs available within a products page
export type ProductsTab =
  | 'all'
  | 'in_stock'
  | 'low_stock'
  | 'out_of_stock'
  | 'categories'
  | 'top_selling';

interface SubTabCounts {
  categories: number;
  items: number;
  lowStock: number;
  outOfStock: number;
}

interface ProductsSubTabsProps {
  activeTab: ProductsTab;
  counts: SubTabCounts;
  onSelect: (tab: ProductsTab) => void;
  variant: 'in_stock' | 'on_website';
}

interface TabButtonProps {
  id: ProductsTab;
  label: string;
  activeTab: ProductsTab;
  onSelect: (id: ProductsTab) => void;
}

function TabButton({ id, label, activeTab, onSelect }: TabButtonProps) {
  const { colors } = useTheme();
  const isActive = activeTab === id;

  return (
    <Pressable
      style={[
        styles.tabButton,
        isActive && { backgroundColor: colors.gold },
        !isActive && { backgroundColor: colors.card },
      ]}
      onPress={() => onSelect(id)}
      accessibilityLabel={`${label}${isActive ? ', currently selected' : ''}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
      accessibilityHint={`Show ${label.toLowerCase()} products`}
    >
      <Text
        style={[
          styles.tabText,
          isActive
            ? {
                color: colors.background,
                fontFamily: TYPOGRAPHY.fontFamily.semiBold,
              }
            : { color: colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ProductsSubTabs({
  activeTab,
  counts,
  onSelect,
  variant,
}: ProductsSubTabsProps) {
  return (
    <View style={styles.tabsContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroller}
        contentContainerStyle={styles.tabsContent}
        testID="products-sub-tabs-scroll"
        accessibilityRole="tablist"
      >
        <TabButton
          id={variant === 'in_stock' ? 'in_stock' : 'all'}
          label={`Items (${counts.items})`}
          activeTab={activeTab}
          onSelect={onSelect}
        />
        <TabButton
          id="categories"
          label={`Categories (${counts.categories})`}
          activeTab={activeTab}
          onSelect={onSelect}
        />
        {variant === 'in_stock' ? (
          <>
            <TabButton
              id="low_stock"
              label={`Low Stock (${counts.lowStock})`}
              activeTab={activeTab}
              onSelect={onSelect}
            />
            <TabButton
              id="out_of_stock"
              label={`Out of Stock (${counts.outOfStock})`}
              activeTab={activeTab}
              onSelect={onSelect}
            />
          </>
        ) : null}
        <TabButton
          id="top_selling"
          label="Top Selling"
          activeTab={activeTab}
          onSelect={onSelect}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontFamily: TYPOGRAPHY.fontFamily.medium,
  },
  tabsContainer: {
    marginBottom: SPACING.lg,
  },
  tabsContent: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  tabsScroller: {
    flexGrow: 0,
    maxHeight: 40,
  },
});
