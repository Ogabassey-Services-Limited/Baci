import { Feather, Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RADIUS } from '@/constants/Colors';
import { useTheme } from '@/hooks/useTheme';

interface FilterBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  minPrice: number;
  maxPrice: number;
  onPriceChange: (min: number, max: number) => void;
  brands: string[];
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  selectedCondition: string;
  onSelectCondition: (condition: string) => void;
  minRating: number;
  onSelectRating: (rating: number) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

type FilterType = 'price' | 'brand' | 'condition' | 'rating';

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  All: 'grid',
  Phones: 'smartphone',
  Smartphones: 'smartphone',
  Gaming: 'target',
  Laptops: 'monitor',
  Accessories: 'headphones',
  Printers: 'printer',
  TVs: 'tv',
};

export function FilterBar({
  categories,
  selectedCategory,
  onSelectCategory,
  minPrice,
  maxPrice,
  onPriceChange,
  brands,
  selectedBrand,
  onSelectBrand,
  selectedCondition,
  onSelectCondition,
  minRating,
  onSelectRating,
  viewMode,
  onViewModeChange,
}: FilterBarProps) {
  const { colors, isDark } = useTheme();
  const [activeFilterType, setActiveFilterType] = useState<FilterType>('price');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [tempMinPrice, setTempMinPrice] = useState(
    minPrice > 0 ? minPrice.toString() : ''
  );
  const [tempMaxPrice, setTempMaxPrice] = useState(
    maxPrice < 3000000 ? maxPrice.toString() : ''
  );

  const getActiveFilterLabel = () => {
    switch (activeFilterType) {
      case 'price':
        return 'Price Range';
      case 'brand':
        return 'Brand';
      case 'condition':
        return 'Condition';
      case 'rating':
        return 'Rating';
      default:
        return 'Filter';
    }
  };

  const renderActiveControls = () => {
    switch (activeFilterType) {
      case 'price':
        return (
          <View style={styles.priceRow}>
            <View
              style={[styles.priceField, { backgroundColor: colors.input }]}
            >
              <Text style={[styles.currency, { color: colors.textSecondary }]}>
                ₦
              </Text>
              <TextInput
                style={[styles.priceInput, { color: colors.text }]}
                value={tempMinPrice}
                onChangeText={setTempMinPrice}
                placeholder="0"
                keyboardType="numeric"
                onBlur={() =>
                  onPriceChange(
                    Number(tempMinPrice) || 0,
                    Number(tempMaxPrice) || 3000000
                  )
                }
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <Text style={[styles.dash, { color: colors.border }]}>-</Text>
            <View style={styles.priceField}>
              <Text style={styles.currency}>₦</Text>
              <TextInput
                style={styles.priceInput}
                value={tempMaxPrice}
                onChangeText={setTempMaxPrice}
                placeholder="Max"
                keyboardType="numeric"
                onBlur={() =>
                  onPriceChange(
                    Number(tempMinPrice) || 0,
                    Number(tempMaxPrice) || 3000000
                  )
                }
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        );
      case 'brand':
        return (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.brandScroll}
            contentContainerStyle={styles.brandScrollContent}
          >
            {['All', ...brands].map((brand) => {
              const isActive = selectedBrand === brand;
              return (
                <Pressable
                  key={brand}
                  onPress={() => onSelectBrand(brand)}
                  style={[
                    styles.brandChip,
                    isActive
                      ? styles.brandChipActive
                      : styles.brandChipInactive,
                  ]}
                  hitSlop={6}
                >
                  <Feather
                    name="grid"
                    size={13}
                    color={isActive ? colors.primaryForeground : colors.icon}
                    style={styles.brandChipIcon}
                  />
                  <Text
                    style={[
                      styles.brandChipText,
                      isActive
                        ? styles.brandChipTextActive
                        : styles.brandChipTextInactive,
                    ]}
                  >
                    {brand}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        );
      case 'condition':
        return (
          <View
            style={[styles.conditionSegment, { backgroundColor: colors.input }]}
          >
            {['All', 'New', 'Open Box', 'Used'].map((condition) => (
              <Pressable
                key={condition}
                onPress={() => onSelectCondition(condition)}
                style={[
                  styles.segmentItem,
                  selectedCondition === condition && styles.segmentItemActive,
                ]}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.segmentText,
                    selectedCondition === condition && styles.segmentTextActive,
                  ]}
                >
                  {condition}
                </Text>
              </Pressable>
            ))}
          </View>
        );
      case 'rating':
        return (
          <View style={styles.ratingRow}>
            {[4, 3, 2, 1].map((rating) => (
              <Pressable
                key={rating}
                onPress={() =>
                  onSelectRating(minRating === rating ? 0 : rating)
                }
                style={[
                  styles.ratingChip,
                  minRating === rating && styles.ratingChipActive,
                ]}
                hitSlop={6}
              >
                <Text
                  style={[
                    styles.ratingText,
                    { color: colors.textSecondary },
                    minRating === rating && [
                      styles.ratingTextActive,
                      { color: colors.rating },
                    ],
                  ]}
                >
                  {rating}+
                </Text>
                <Ionicons
                  name="star"
                  size={10}
                  color={
                    minRating === rating
                      ? colors.rating
                      : colors.mutedForeground
                  }
                />
              </Pressable>
            ))}
            <Pressable onPress={() => onSelectRating(0)} hitSlop={8}>
              <Text
                style={[
                  styles.anyText,
                  minRating === 0 && styles.anyTextActive,
                ]}
              >
                Any
              </Text>
            </Pressable>
          </View>
        );
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      {/* Backdrop for dismissal */}
      {isFilterMenuOpen && (
        <Pressable
          style={styles.backdrop}
          onPress={() => setIsFilterMenuOpen(false)}
        />
      )}
      {/* Category Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryContent}
        style={styles.categoryList}
      >
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          const icon = CATEGORY_ICONS[cat] || 'grid';
          return (
            <Pressable
              key={cat}
              onPress={() => onSelectCategory(cat)}
              style={[styles.catPill, isActive && styles.catPillActive]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${cat} category`}
              accessibilityState={{ selected: isActive }}
            >
              <Feather
                name={icon}
                size={15}
                color={isActive ? colors.primaryForeground : colors.icon}
              />
              <Text
                style={[styles.catText, isActive && styles.catTextActive]}
                numberOfLines={1}
              >
                {cat}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tools Section */}
      <View style={styles.toolsContainer}>
        <View style={styles.mainTools}>
          {/* Filter Toggle */}
          <View style={styles.filterWrapper}>
            <Pressable
              onPress={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
              style={styles.filterToggle}
              hitSlop={12}
            >
              <Feather name="sliders" size={16} color={colors.primary} />
              <Text style={styles.filterLabel}>{getActiveFilterLabel()}</Text>
              <Feather
                name="chevron-down"
                size={12}
                color={colors.primary}
                style={[
                  styles.chevron,
                  {
                    transform: [
                      { rotate: isFilterMenuOpen ? '180deg' : '0deg' },
                    ],
                  },
                ]}
              />
            </Pressable>

            {/* Filter Menu Popover */}
            {isFilterMenuOpen && (
              <View
                style={[
                  styles.popover,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    shadowColor: isDark ? 'transparent' : '#000',
                  },
                ]}
              >
                {[
                  { id: 'price', label: 'Price Range', icon: 'tag' },
                  { id: 'brand', label: 'Brand', icon: 'layers' },
                  { id: 'condition', label: 'Condition', icon: 'check-circle' },
                  { id: 'rating', label: 'Rating', icon: 'star' },
                ].map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setActiveFilterType(item.id as FilterType);
                      setIsFilterMenuOpen(false);
                    }}
                    style={[
                      styles.popoverItem,
                      activeFilterType === item.id && styles.popoverItemActive,
                    ]}
                  >
                    <Feather
                      name={item.icon as keyof typeof Feather.glyphMap}
                      size={16}
                      color={
                        activeFilterType === item.id
                          ? colors.primary
                          : colors.icon
                      }
                    />
                    <Text
                      style={[
                        styles.popoverText,
                        activeFilterType === item.id &&
                          styles.popoverTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {activeFilterType === item.id && (
                      <Feather
                        name="check"
                        size={14}
                        color={colors.primary}
                        style={styles.checkIcon}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.vDivider, { backgroundColor: colors.border }]} />

          {/* Dynamic Controls Area */}
          <View style={styles.dynamicArea}>{renderActiveControls()}</View>

          {/* View Toggle */}
          <View
            style={[
              styles.viewToggle,
              { backgroundColor: colors.input, borderColor: colors.border },
            ]}
          >
            <Pressable
              onPress={() => onViewModeChange('grid')}
              style={[
                styles.viewBtn,
                viewMode === 'grid' && styles.viewBtnActive,
              ]}
              hitSlop={8}
            >
              <Feather
                name="grid"
                size={15}
                color={viewMode === 'grid' ? colors.primary : colors.icon}
              />
            </Pressable>
            <Pressable
              onPress={() => onViewModeChange('list')}
              style={[
                styles.viewBtn,
                viewMode === 'list' && styles.viewBtnActive,
              ]}
              hitSlop={8}
            >
              <Feather
                name="list"
                size={15}
                color={viewMode === 'list' ? colors.primary : colors.icon}
              />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    zIndex: 1000,
    elevation: 4,
    paddingBottom: 4,
  },
  // Categories
  categoryList: {
    borderBottomWidth: 1,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1,
    gap: 6,
  },
  catPillActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  catText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'serif',
  },
  catTextActive: {
  },
  // Tools Row
  toolsContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 2000,
  },
  mainTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 2000,
  },
  filterWrapper: {
    position: 'relative',
    zIndex: 3000,
    elevation: 20,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'serif',
  },
  chevron: {
    marginTop: 1,
  },
  popover: {
    position: 'absolute',
    top: 42,
    left: 0,
    width: 200,
    borderRadius: 16,
    padding: 6,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 25,
    borderWidth: 1,
    zIndex: 4000,
  },
  popoverItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 10,
  },
  popoverItemActive: {
  },
  popoverText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'serif',
  },
  popoverTextActive: {
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  vDivider: {
    width: 1,
    height: 24,
  },
  dynamicArea: {
    flex: 1,
    minHeight: 36,
    justifyContent: 'center',
  },
  // Active Controls
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
  },
  currency: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 2,
  },
  priceInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    padding: 0,
    fontFamily: 'serif',
  },
  dash: {
    fontWeight: '700',
    fontSize: 10,
  },
  brandScroll: {
    flexGrow: 0,
  },
  brandScrollContent: {
    alignItems: 'center',
    paddingRight: 4,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    marginRight: 8,
  },
  brandChipActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  brandChipInactive: {
  },
  brandChipIcon: {
    marginRight: 6,
  },
  brandChipText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'serif',
  },
  brandChipTextActive: {
  },
  brandChipTextInactive: {
  },
  conditionSegment: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  segmentItemActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'serif',
  },
  segmentTextActive: {
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingChipActive: {
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'serif',
  },
  ratingTextActive: {
  },
  anyText: {
    fontSize: 11,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  anyTextActive: {
    fontWeight: '800',
  },
  // View Toggle
  viewToggle: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
  },
  viewBtn: {
    padding: 6,
    borderRadius: 8,
  },
  viewBtnActive: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backdrop: {
    position: 'absolute',
    top: -500,
    left: -500,
    right: -500,
    bottom: -1500,
    backgroundColor: 'transparent',
    zIndex: 105,
  },
  promoBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  promoText: {
    fontSize: 13,
    textAlign: 'center',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  promoHighlight: {
    fontWeight: '900',
  },
});
