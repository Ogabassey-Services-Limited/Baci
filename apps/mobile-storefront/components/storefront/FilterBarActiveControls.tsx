import { Feather, Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { palette } from '@/constants/Colors';
import { styles } from './FilterBar.styles';

type FilterType = 'price' | 'brand' | 'condition' | 'rating';
const MAX_PRICE_CEILING = 3_000_000;

interface FilterBarActiveControlsProps {
  activeFilterType: FilterType;
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
}

function normalizePriceInput(value: string, fallback: number) {
  if (value.trim() === '') {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(MAX_PRICE_CEILING, Math.max(0, parsedValue));
}

function getBrandOptions(brands: string[]) {
  const seenBrands = new Set(['All']);
  const dedupedBrands = brands.filter((brand) => {
    if (seenBrands.has(brand)) {
      return false;
    }

    seenBrands.add(brand);
    return true;
  });

  return ['All', ...dedupedBrands];
}

export function FilterBarActiveControls({
  activeFilterType,
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
}: FilterBarActiveControlsProps) {
  const [tempMinPrice, setTempMinPrice] = useState(
    minPrice > 0 ? minPrice.toString() : ''
  );
  const [tempMaxPrice, setTempMaxPrice] = useState(
    maxPrice < MAX_PRICE_CEILING ? maxPrice.toString() : ''
  );

  useEffect(() => {
    setTempMinPrice(minPrice > 0 ? minPrice.toString() : '');
    setTempMaxPrice(maxPrice < MAX_PRICE_CEILING ? maxPrice.toString() : '');
  }, [minPrice, maxPrice]);

  const handlePriceBlur = () => {
    onPriceChange(
      normalizePriceInput(tempMinPrice, 0),
      normalizePriceInput(tempMaxPrice, MAX_PRICE_CEILING)
    );
  };
  const brandOptions = getBrandOptions(brands);

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
              role="spinbutton"
              accessibilityLabel="Min"
              placeholder="0"
              keyboardType="numeric"
              onBlur={handlePriceBlur}
              placeholderTextColor={palette.gray[400]}
            />
          </View>
          <Text style={styles.dash}>-</Text>
          <View style={styles.priceField}>
            <Text style={styles.currency}>₦</Text>
            <TextInput
              style={styles.priceInput}
              value={tempMaxPrice}
              onChangeText={setTempMaxPrice}
              role="spinbutton"
              accessibilityLabel="Max"
              placeholder="Max"
              keyboardType="numeric"
              onBlur={handlePriceBlur}
              placeholderTextColor={palette.gray[400]}
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
          {brandOptions.map((brand) => {
            const isActive = selectedBrand === brand;
            return (
              <Pressable
                key={brand}
                accessibilityRole="button"
                accessibilityLabel={brand}
                accessibilityState={{ selected: isActive }}
                onPress={() => onSelectBrand(brand)}
                style={[
                  styles.brandChip,
                  isActive ? styles.brandChipActive : styles.brandChipInactive,
                ]}
                hitSlop={6}
              >
                <Feather
                  name="grid"
                  size={13}
                  color={isActive ? palette.white : palette.gray[500]}
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
              accessibilityRole="button"
              accessibilityLabel={condition}
              accessibilityState={{
                selected: selectedCondition === condition,
              }}
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
              accessibilityRole="button"
              accessibilityLabel={`${rating}+`}
              accessibilityState={{ selected: minRating === rating }}
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
                color={
                  minRating === rating
                    ? palette.amber[700]
                    : palette.amber[500]
                }
              />
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Any"
            accessibilityState={{ selected: minRating === 0 }}
            onPress={() => onSelectRating(0)}
            hitSlop={8}
          >
            <Text
              style={[styles.anyText, minRating === 0 && styles.anyTextActive]}
            >
              Any
            </Text>
          </Pressable>
        </View>
      );
  }
}
