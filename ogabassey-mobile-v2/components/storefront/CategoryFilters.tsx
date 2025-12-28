import { View, Text, FlatList, Pressable, TextInput } from 'react-native';
import {
    LayoutGrid,
    Smartphone,
    Gamepad2,
    Laptop,
    Headphones,
    Printer,
    SlidersHorizontal,
    List,
    Tag,
    Layers,
    CheckCircle,
    Star,
    ChevronUp,
    ChevronDown,
} from 'lucide-react-native';
import { useState, useEffect } from 'react';

// --- Data Constants ---
const CATEGORIES = [
    { id: 'All', label: 'All', icon: LayoutGrid },
    { id: 'Smartphones', label: 'Smartphones', icon: Smartphone },
    { id: 'Laptops', label: 'Laptops', icon: Laptop },
    { id: 'Gaming', label: 'Gaming', icon: Gamepad2 },
    { id: 'Accessories', label: 'Accessories', icon: Headphones },
    { id: 'Printers', label: 'Printers', icon: Printer },
];

const BRANDS = [
    { id: 'All', label: 'All Brands', icon: Layers },
    { id: 'Apple', label: 'Apple', icon: Layers },
    { id: 'Samsung', label: 'Samsung', icon: Layers },
    { id: 'Dell', label: 'Dell', icon: Layers },
    { id: 'HP', label: 'HP', icon: Layers },
    { id: 'Sony', label: 'Sony', icon: Layers },
    { id: 'Google', label: 'Google', icon: Layers },
];

const CONDITIONS = [
    { id: 'All', label: 'Any Condition', icon: CheckCircle },
    { id: 'New', label: 'Brand New', icon: CheckCircle },
    { id: 'Open Box', label: 'Open Box', icon: CheckCircle },
    { id: 'Used', label: 'Used', icon: CheckCircle },
];

const RATINGS = [
    { id: 0, label: 'Any Rating', icon: Star },
    { id: 4.5, label: '4.5★ & up', icon: Star },
    { id: 4.0, label: '4.0★ & up', icon: Star },
    { id: 3.5, label: '3.5★ & up', icon: Star },
];

const FILTER_OPTIONS = [
    { id: 'category', label: 'Category', icon: LayoutGrid },
    { id: 'price', label: 'Price Range', icon: Tag },
    { id: 'brand', label: 'Brand', icon: Layers },
    { id: 'condition', label: 'Condition', icon: CheckCircle },
    { id: 'rating', label: 'Rating', icon: Star },
];

interface CategoryFiltersProps {
    selectedCategory: string;
    onSelectCategory: (category: string) => void;

    selectedBrand?: string;
    onSelectBrand?: (brand: string) => void;

    selectedCondition?: string;
    onSelectCondition?: (condition: string) => void;

    selectedRating?: number;
    onSelectRating?: (rating: number) => void;

    minPrice?: number;
    maxPrice?: number;
    onPriceChange?: (min: number, max: number) => void;
    viewMode?: 'grid' | 'list';
    onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function CategoryFilters({
    selectedCategory,
    onSelectCategory,
    selectedBrand = 'All',
    onSelectBrand,
    selectedCondition = 'All',
    onSelectCondition,
    selectedRating = 0,
    onSelectRating,
    minPrice = 0,
    maxPrice = 0,
    onPriceChange,
    viewMode = 'grid',
    onViewModeChange,
}: CategoryFiltersProps) {
    const [showFilterMenu, setShowFilterMenu] = useState(false);
    // Default to 'category' mode so categories show first
    const [activeFilter, setActiveFilter] = useState('category');

    const [localMinPrice, setLocalMinPrice] = useState(minPrice.toString());
    const [localMaxPrice, setLocalMaxPrice] = useState(maxPrice.toString());

    // Sync local active filter if user manually resets logic (optional, but good practice)
    useEffect(() => {
        // If needed we could force reset activeFilter here
    }, []);

    const handleFilterSelect = (filterId: string) => {
        setActiveFilter(filterId);
        // Don't close menu immediately? Or do? 
        // Web behavior usually keeps context. 
        // Let's close menu to let user see the horizontal list changed
        setShowFilterMenu(false);
    };

    const handleApplyPriceFilter = () => {
        if (onPriceChange) {
            onPriceChange(
                parseInt(localMinPrice) || 0,
                parseInt(localMaxPrice) || 0
            );
        }
    };

    // Determine what data to show in horizontal list
    let listData: any[] = [];
    let selectedValue: any = null;
    let onSelect: ((val: any) => void) | undefined = undefined;

    switch (activeFilter) {
        case 'brand':
            listData = BRANDS;
            selectedValue = selectedBrand;
            onSelect = onSelectBrand;
            break;
        case 'condition':
            listData = CONDITIONS;
            selectedValue = selectedCondition;
            onSelect = onSelectCondition;
            break;
        case 'rating':
            listData = RATINGS;
            selectedValue = selectedRating;
            onSelect = onSelectRating;
            break;
        case 'category':
        default:
            // Default or 'price' (price keeps category view or maybe empty? Web keeps categories visible usually)
            // Let's fallback to CATEGORIES for price view too, or just stick to category view
            listData = CATEGORIES;
            selectedValue = selectedCategory;
            onSelect = onSelectCategory;
            break;
    }

    const hasActiveFilters = minPrice > 0 || maxPrice > 0 || selectedBrand !== 'All' || selectedCondition !== 'All';

    // Get label for current active filter mode to show in dropdown trigger?
    // Or just generic "Filters"
    const activeFilterLabel = FILTER_OPTIONS.find(f => f.id === activeFilter)?.label || 'Filters';

    return (
        <View className="bg-white border-b border-gray-100 z-50">
            {/* Horizontal List (Dynamic Content) */}
            <View className="py-3">
                <FlatList
                    data={listData}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => {
                        const isSelected = selectedValue === item.id;
                        const Icon = item.icon;

                        return (
                            <Pressable
                                onPress={() => onSelect && onSelect(item.id)}
                                className={`flex-row items-center px-4 py-2.5 rounded-full border ${isSelected
                                    ? 'bg-red-600 border-red-600'
                                    : 'bg-white border-gray-200'
                                    }`}
                            >
                                <Icon
                                    size={16}
                                    color={isSelected ? '#FFFFFF' : '#4B5563'}
                                    strokeWidth={2}
                                />
                                <Text
                                    className={`ml-2 text-sm font-semibold ${isSelected ? 'text-white' : 'text-gray-700'
                                        }`}
                                >
                                    {item.label}
                                </Text>
                            </Pressable>
                        );
                    }}
                />
            </View>

            {/* Filter Controls Row */}
            <View className="flex-row items-center px-4 pb-3 gap-3">
                {/* Filter Dropdown Button */}
                <Pressable
                    onPress={() => setShowFilterMenu(!showFilterMenu)}
                    className={`flex-row items-center px-3 py-2.5 rounded-xl border ${showFilterMenu || hasActiveFilters
                        ? 'bg-red-600 border-red-600'
                        : 'bg-red-600 border-red-600'
                        }`}
                >
                    <SlidersHorizontal size={16} color="#FFFFFF" strokeWidth={2} />
                    <Text className="text-white font-medium ml-2 text-xs">
                        {activeFilter === 'price' || activeFilter === 'category' ? 'Filter' : activeFilterLabel}
                    </Text>
                    {showFilterMenu ? (
                        <ChevronUp size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    ) : (
                        <ChevronDown size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
                    )}
                </Pressable>

                {/* Price Inputs - Only show when Price or Category is active? Or always?
                    Web usually shows price inputs always visible in advanced bar.
                 */}
                <View className="flex-row flex-1 items-center gap-2">
                    <View className="flex-1 flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <Text className="text-gray-500 text-xs mr-1">₦</Text>
                        <TextInput
                            placeholder="Min"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={localMinPrice !== '0' ? localMinPrice : ''}
                            onChangeText={setLocalMinPrice}
                            onEndEditing={() => handleApplyPriceFilter()}
                            className="flex-1 text-sm text-gray-900"
                        />
                    </View>
                    <Text className="text-gray-300">-</Text>
                    <View className="flex-1 flex-row items-center bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                        <Text className="text-gray-500 text-xs mr-1">₦</Text>
                        <TextInput
                            placeholder="Max"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="numeric"
                            value={localMaxPrice !== '0' ? localMaxPrice : ''}
                            onChangeText={setLocalMaxPrice}
                            onEndEditing={() => handleApplyPriceFilter()}
                            className="flex-1 text-sm text-gray-900"
                        />
                    </View>
                </View>

                {/* View Mode Toggle */}
                <View className="flex-row bg-gray-100 rounded-lg p-1 border border-gray-200">
                    <Pressable
                        onPress={() => onViewModeChange?.('grid')}
                        className={`px-2.5 py-1.5 rounded-md ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <LayoutGrid size={16} color={viewMode === 'grid' ? '#1F2937' : '#9CA3AF'} />
                    </Pressable>
                    <Pressable
                        onPress={() => onViewModeChange?.('list')}
                        className={`px-2.5 py-1.5 rounded-md ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
                    >
                        <List size={16} color={viewMode === 'list' ? '#1F2937' : '#9CA3AF'} />
                    </Pressable>
                </View>
            </View>

            {/* Filter Dropdown Menu */}
            {showFilterMenu && (
                <View className="absolute top-24 left-4 bg-white rounded-xl shadow-lg border border-gray-100 z-50 w-48 py-1">
                    {FILTER_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const isActive = activeFilter === option.id;

                        return (
                            <Pressable
                                key={option.id}
                                onPress={() => handleFilterSelect(option.id)}
                                className={`flex-row items-center px-4 py-3 border-b border-gray-50 last:border-0 ${isActive ? 'bg-gray-50' : ''}`}
                            >
                                <Icon size={16} color={isActive ? '#DC2626' : '#4B5563'} />
                                <Text className={`ml-3 text-sm ${isActive ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                                    {option.label}
                                </Text>
                                {isActive && (
                                    <View className="ml-auto">
                                        <CheckCircle size={16} color="#DC2626" />
                                    </View>
                                )}
                            </Pressable>
                        );
                    })}
                </View>
            )}
        </View>
    );
}

