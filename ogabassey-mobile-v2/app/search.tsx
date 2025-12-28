import { View, Text, ScrollView, ActivityIndicator, Pressable, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useProducts, useMerchant } from '../hooks/use-store';
import { ProductCard } from '../components/storefront/ProductCard';
import { Header } from '../components/storefront/Header';
import { useState, useMemo, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SearchScreen() {
    const { q } = useLocalSearchParams<{ q: string }>();
    const router = useRouter();

    // Local state for additional filtering within search results
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
    const [showSortMenu, setShowSortMenu] = useState(false);

    const { data: merchant } = useMerchant();
    const { data, isLoading } = useProducts(merchant?.id, { search: q });
    const products = data?.pages.flat() || [];

    // Filter products based on search query
    // NOTE: Filtering is now handled server-side via useProducts hook
    const searchResults = useMemo(() => {
        return products;
    }, [products]);

    // Sort results
    const sortedResults = useMemo(() => {
        let res = [...searchResults];
        if (sortBy === 'price_asc') {
            res.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price_desc') {
            res.sort((a, b) => b.price - a.price);
        } else {
            // Newest (assuming id or created_at, but we'll leave as is for now if consistent)
            // If we had created_at we would sort. For now, default order.
        }
        return res;
    }, [searchResults, sortBy]);

    return (
        <View className="flex-1 bg-gray-50">
            <StatusBar barStyle="light-content" />
            <Stack.Screen options={{ headerShown: false }} />

            <Header />

            <View className="px-4 py-3 flex-row items-center justify-between bg-white border-b border-gray-100">
                <Text className="text-base font-bold text-gray-900">
                    {q ? `Results for "${q}"` : 'All Products'}
                </Text>
                <Text className="text-xs text-gray-500">
                    {sortedResults.length} found
                </Text>
            </View>

            {/* Filter/Sort Bar */}
            <View className="flex-row px-4 py-2 gap-2 bg-white mb-2">
                <Pressable
                    onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                    className="p-2 bg-gray-100 rounded-md"
                >
                    <Ionicons name={viewMode === 'grid' ? 'list' : 'grid'} size={20} color="#374151" />
                </Pressable>

                <Pressable
                    onPress={() => setShowSortMenu(!showSortMenu)}
                    className="flex-1 flex-row items-center justify-between px-3 bg-gray-100 rounded-md"
                >
                    <Text className="text-sm font-medium text-gray-700">
                        Sort: {sortBy === 'newest' ? 'Newest' : sortBy === 'price_asc' ? 'Price: Low to High' : 'Price: High to Low'}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="#374151" />
                </Pressable>

                {/* Sort Menu Dropdown - simple conditional render for now */}
                {showSortMenu && (
                    <View className="absolute top-12 right-4 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-1">
                        <Pressable onPress={() => { setSortBy('newest'); setShowSortMenu(false); }} className="p-3 hover:bg-gray-50">
                            <Text className={`text-sm ${sortBy === 'newest' ? 'font-bold text-red-600' : 'text-gray-700'}`}>Newest</Text>
                        </Pressable>
                        <Pressable onPress={() => { setSortBy('price_asc'); setShowSortMenu(false); }} className="p-3 hover:bg-gray-50">
                            <Text className={`text-sm ${sortBy === 'price_asc' ? 'font-bold text-red-600' : 'text-gray-700'}`}>Price: Low to High</Text>
                        </Pressable>
                        <Pressable onPress={() => { setSortBy('price_desc'); setShowSortMenu(false); }} className="p-3 hover:bg-gray-50">
                            <Text className={`text-sm ${sortBy === 'price_desc' ? 'font-bold text-red-600' : 'text-gray-700'}`}>Price: High to Low</Text>
                        </Pressable>
                    </View>
                )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {isLoading ? (
                    <ActivityIndicator size="large" color="#DC2626" className="mt-10" />
                ) : sortedResults.length > 0 ? (
                    <View className={viewMode === 'grid' ? 'flex-row flex-wrap justify-between' : ''}>
                        {sortedResults.map((product) => (
                            <ProductCard
                                key={product.id}
                                product={{
                                    id: product.id,
                                    title: product.name,
                                    slug: product.slug,
                                    price: product.price,
                                    originalPrice: product.compare_at_price || undefined,
                                    image: product.images?.[0] || 'https://via.placeholder.com/300',
                                    condition: product.condition || 'Brand New',
                                    rating: 4.8,
                                    reviews: 12,
                                    isCyberDeal: !!product.compare_at_price,
                                }}
                                viewMode={viewMode}
                            />
                        ))}
                    </View>
                ) : (
                    <View className="items-center justify-center mt-10">
                        <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                            <Ionicons name="search" size={32} color="#9CA3AF" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">No results found</Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            Try adjusting your search or filter to find what you're looking for.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
