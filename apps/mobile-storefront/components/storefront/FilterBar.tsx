import Feather, { type FeatherIconName } from "@react-native-vector-icons/feather/static";
import Ionicons from "@react-native-vector-icons/ionicons/static";
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BRAND, RADIUS } from '@/constants/Colors';

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

const CATEGORY_ICONS: Record<string, FeatherIconName> = {
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
            <View style={styles.priceField}>
              <Text style={styles.currency}>₦</Text>
              <TextInput
                style={styles.priceInput}
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
            <Text style={styles.dash}>-</Text>
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
                    color={isActive ? '#FFF' : '#6B7280'}
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
          <View style={styles.conditionSegment}>
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
                    minRating === rating && styles.ratingTextActive,
                  ]}
                >
                  {rating}+
                </Text>
                <Ionicons
                  name="star"
                  size={10}
                  color={minRating === rating ? '#B45309' : '#F59E0B'}
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
    <View style={styles.container}>
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
                color={isActive ? '#FFF' : '#4B5563'}
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
              <Feather name="sliders" size={16} color={BRAND.primary} />
              <Text style={styles.filterLabel}>{getActiveFilterLabel()}</Text>
              <Feather
                name="chevron-down"
                size={12}
                color={BRAND.primary}
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
              <View style={styles.popover}>
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
                      name={item.icon as FeatherIconName}
                      size={16}
                      color={
                        activeFilterType === item.id ? BRAND.primary : '#6B7280'
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
                        color={BRAND.primary}
                        style={styles.checkIcon}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.vDivider} />

          {/* Dynamic Controls Area */}
          <View style={styles.dynamicArea}>{renderActiveControls()}</View>

          {/* View Toggle */}
          <View style={styles.viewToggle}>
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
                color={viewMode === 'grid' ? BRAND.primary : '#9CA3AF'}
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
                color={viewMode === 'list' ? BRAND.primary : '#9CA3AF'}
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    zIndex: 1000,
    elevation: 4,
    paddingBottom: 4,
  },
  // Categories
  categoryList: {
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
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
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  catPillActive: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
    shadowColor: BRAND.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  catText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    fontFamily: 'serif',
  },
  catTextActive: {
    color: '#FFF',
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
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: BRAND.primary,
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
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 25,
    borderWidth: 1,
    borderColor: '#F3F4F6',
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
    backgroundColor: '#FEF2F2',
  },
  popoverText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    fontFamily: 'serif',
  },
  popoverTextActive: {
    color: BRAND.primary,
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  vDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 32,
  },
  currency: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '700',
    marginRight: 2,
  },
  priceInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
    fontFamily: 'serif',
  },
  dash: {
    color: '#D1D5DB',
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
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  brandChipInactive: {
    backgroundColor: '#FFF',
    borderColor: '#E5E7EB',
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
    color: '#FFF',
  },
  brandChipTextInactive: {
    color: '#4B5563',
  },
  conditionSegment: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
    fontFamily: 'serif',
  },
  segmentTextActive: {
    color: '#111827',
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
    backgroundColor: '#FEF3C7',
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    fontFamily: 'serif',
  },
  ratingTextActive: {
    color: '#B45309',
  },
  anyText: {
    fontSize: 11,
    color: '#9CA3AF',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  anyTextActive: {
    color: '#111827',
    fontWeight: '800',
  },
  // View Toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    padding: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  viewBtn: {
    padding: 6,
    borderRadius: 8,
  },
  viewBtnActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
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
    backgroundColor: '#FFF5F5',
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  promoText: {
    fontSize: 13,
    color: '#374151',
    textAlign: 'center',
    fontFamily: 'serif',
    fontWeight: '600',
  },
  promoHighlight: {
    color: BRAND.primary,
    fontWeight: '900',
  },
});
