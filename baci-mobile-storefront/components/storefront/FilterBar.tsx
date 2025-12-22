import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Dimensions,
    TextInput,
    Modal,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import Colors, { BRAND, SPACING, RADIUS, TYPOGRAPHY } from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    Gaming: 'target', // Gamepad icon in Feather is missing, using target or similar? Feather has 'disc' or 'target' or 'box'. Let's use 'monitor' for generic or check Ionicons.
    Laptops: 'monitor',
    Accessories: 'headphones',
    Printers: 'printer',
};

// Fallback for Gaming to Ionicons if needed, but keeping simple for now.

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
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'light'];

    const [activeFilterType, setActiveFilterType] = useState<FilterType | null>(null);
    const [tempMinPrice, setTempMinPrice] = useState(minPrice.toString());
    const [tempMaxPrice, setTempMaxPrice] = useState(maxPrice > 0 ? maxPrice.toString() : '');

    const getActiveFilterLabel = () => {
        switch (activeFilterType) {
            case 'price': return 'Price Range';
            case 'brand': return 'Brand';
            case 'condition': return 'Condition';
            case 'rating': return 'Rating';
            default: return 'Filter';
        }
    };

    const renderFilterContent = () => {
        switch (activeFilterType) {
            case 'price':
                return (
                    <View style={styles.priceContainer}>
                        <View style={styles.priceInputWrapper}>
                            <Text style={styles.currencySymbol}>₦</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={tempMinPrice}
                                onChangeText={setTempMinPrice}
                                placeholder="Min"
                                keyboardType="numeric"
                                returnKeyType="done"
                                onSubmitEditing={() => onPriceChange(Number(tempMinPrice) || 0, Number(tempMaxPrice) || 0)}
                            />
                        </View>
                        <Text style={styles.priceDash}>-</Text>
                        <View style={styles.priceInputWrapper}>
                            <Text style={styles.currencySymbol}>₦</Text>
                            <TextInput
                                style={styles.priceInput}
                                value={tempMaxPrice}
                                onChangeText={setTempMaxPrice}
                                placeholder="Max"
                                keyboardType="numeric"
                                returnKeyType="done"
                                onSubmitEditing={() => onPriceChange(Number(tempMinPrice) || 0, Number(tempMaxPrice) || 0)}
                            />
                        </View>
                    </View>
                );
            case 'brand':
                return (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                        {['All', ...brands].map((brand) => (
                            <Pressable
                                key={brand}
                                onPress={() => onSelectBrand(brand)}
                                style={[
                                    styles.filterChip,
                                    selectedBrand === brand ? styles.filterChipActive : styles.filterChipInactive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        selectedBrand === brand ? styles.filterChipTextActive : styles.filterChipTextInactive,
                                    ]}
                                >
                                    {brand}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                );
            case 'condition':
                return (
                    <View style={styles.segmentContainer}>
                        {['All', 'New', 'Open Box', 'Used'].map((condition) => (
                            <Pressable
                                key={condition}
                                onPress={() => onSelectCondition(condition)}
                                style={[
                                    styles.segmentButton,
                                    selectedCondition === condition && styles.segmentButtonActive,
                                ]}
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
                                onPress={() => onSelectRating(minRating === rating ? 0 : rating)}
                                style={[
                                    styles.ratingChip,
                                    minRating === rating ? styles.ratingChipActive : styles.ratingChipInactive,
                                ]}
                            >
                                <Text style={[styles.ratingText, minRating === rating && styles.ratingTextActive]}>{rating}+</Text>
                                <Ionicons name="star" size={12} color={minRating === rating ? '#B45309' : '#9CA3AF'} />
                            </Pressable>
                        ))}
                        <Pressable onPress={() => onSelectRating(0)}>
                            <Text style={[styles.ratingAnyText, minRating === 0 && styles.ratingAnyTextActive]}>Any</Text>
                        </Pressable>
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {/* Category Horizontal Scroll */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryScroll}
                style={styles.categoryScrollWrapper}
            >
                {categories.map((category) => {
                    const iconName = CATEGORY_ICONS[category] || 'grid';
                    const isActive = selectedCategory === category;
                    return (
                        <Pressable
                            key={category}
                            onPress={() => onSelectCategory(category)}
                            style={[styles.categoryPill, isActive && styles.categoryPillActive]}
                        >
                            <Feather name={iconName} size={14} color={isActive ? '#FFF' : '#4B5563'} />
                            <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
                                {category}
                            </Text>
                        </Pressable>
                    );
                })}
            </ScrollView>

            {/* Tools Row: Filter Toggle + Active Filters + View Mode */}
            <View style={styles.toolsRow}>
                {/* Main Filter Toggle */}
                <Pressable
                    style={styles.filterToggle}
                    onPress={() => setActiveFilterType(activeFilterType ? null : 'price')} // Toggle or default to price
                >
                    <Feather name="sliders" size={16} color={BRAND.primary} />
                    <Text style={styles.filterToggleText}>{activeFilterType ? getActiveFilterLabel() : 'Filter'}</Text>
                    <Feather
                        name="chevron-down"
                        size={14}
                        color={BRAND.primary}
                        style={{ transform: [{ rotate: activeFilterType ? '180deg' : '0deg' }] }}
                    />
                </Pressable>

                <View style={styles.divider} />

                {/* Dynamic Filter Area */}
                <View style={{ flex: 1, paddingLeft: 8 }}>
                    {!activeFilterType ? (
                        // Show Quick Chips when menu closed
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
                            {[{ id: 'price', label: 'Price' }, { id: 'brand', label: 'Brand' }, { id: 'condition', label: 'Condition' }, { id: 'rating', label: 'Rating' }].map(f => (
                                <Pressable key={f.id} onPress={() => setActiveFilterType(f.id as FilterType)} style={styles.quickChip}>
                                    <Text style={styles.quickChipText}>{f.label}</Text>
                                </Pressable>
                            ))}
                        </ScrollView>
                    ) : (
                        // Show Active Filter Content
                        renderFilterContent()
                    )}
                </View>

                {/* View Mode Toggle */}
                <View style={styles.viewToggle}>
                    <Pressable
                        onPress={() => onViewModeChange('grid')}
                        style={[styles.viewIcon, viewMode === 'grid' && styles.viewIconActive]}
                    >
                        <Feather name="grid" size={16} color={viewMode === 'grid' ? BRAND.primary : '#9CA3AF'} />
                    </Pressable>
                    <Pressable
                        onPress={() => onViewModeChange('list')}
                        style={[styles.viewIcon, viewMode === 'list' && styles.viewIconActive]}
                    >
                        <Feather name="list" size={16} color={viewMode === 'list' ? BRAND.primary : '#9CA3AF'} />
                    </Pressable>
                </View>

                {/* Close Active Filter Button (small X) */}
                {activeFilterType && (
                    <Pressable onPress={() => setActiveFilterType(null)} style={{ padding: 8 }}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </Pressable>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        paddingBottom: 8,
    },
    categoryScrollWrapper: {
        borderBottomWidth: 1,
        borderBottomColor: '#F9FAFB',
    },
    categoryScroll: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        gap: 8,
    },
    categoryPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 6,
    },
    categoryPillActive: {
        backgroundColor: BRAND.primary,
        borderColor: BRAND.primary,
    },
    categoryText: {
        fontSize: 13,
        fontFamily: 'serif',
        color: '#4B5563',
        fontWeight: '500',
    },
    categoryTextActive: {
        color: '#FFF',
    },
    toolsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 8,
        height: 44, // Fixed height for alignment
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        gap: 6,
    },
    filterToggleText: {
        fontSize: 13,
        fontFamily: 'serif',
        color: BRAND.primary,
        fontWeight: '700',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 10,
    },
    // Filter Inputs
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        flex: 1,
    },
    priceInputWrapper: {
        flex: 1,
        position: 'relative',
        height: 32,
    },
    currencySymbol: {
        position: 'absolute',
        left: 8,
        top: 8,
        fontSize: 10,
        color: '#6B7280',
        fontFamily: 'serif',
    },
    priceInput: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        paddingLeft: 20,
        paddingRight: 4,
        fontSize: 12,
        fontFamily: 'serif',
        color: '#111827',
    },
    priceDash: {
        color: '#D1D5DB',
    },
    chipRow: {
        gap: 6,
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFF',
    },
    filterChipActive: {
        backgroundColor: '#111827',
        borderColor: '#111827',
    },
    filterChipInactive: {},
    filterChipText: {
        fontSize: 11,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#4B5563',
    },
    filterChipTextActive: {
        color: '#FFF',
    },
    filterChipTextInactive: {},
    segmentContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        padding: 2,
        borderRadius: 8,
        flex: 1,
    },
    segmentButton: {
        flex: 1,
        paddingVertical: 4,
        alignItems: 'center',
        borderRadius: 6,
    },
    segmentButtonActive: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
    segmentText: {
        fontSize: 10,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#6B7280',
    },
    segmentTextActive: {
        color: '#111827',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingHorizontal: 6,
        paddingVertical: 4,
        borderRadius: 4,
    },
    ratingChipActive: {
        backgroundColor: '#FEF3C7',
    },
    ratingChipInactive: {
        backgroundColor: 'transparent'
    },
    ratingText: {
        fontSize: 11,
        fontFamily: 'serif',
        fontWeight: '700',
        color: '#6B7280',
    },
    ratingTextActive: {
        color: '#B45309',
    },
    ratingAnyText: {
        fontSize: 11,
        fontFamily: 'serif',
        color: '#9CA3AF',
        textDecorationLine: 'underline',
    },
    ratingAnyTextActive: {
        color: '#111827',
    },
    quickChip: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#F9FAFB',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB'
    },
    quickChipText: {
        fontSize: 10,
        fontFamily: 'serif',
        color: '#6B7280'
    },
    viewToggle: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 2,
        marginLeft: 8,
    },
    viewIcon: {
        padding: 6,
        borderRadius: 6,
    },
    viewIconActive: {
        backgroundColor: '#FFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    },
});
