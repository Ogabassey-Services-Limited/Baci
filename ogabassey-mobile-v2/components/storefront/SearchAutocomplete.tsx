/**
 * SearchAutocomplete Component
 * 2025 Best Practice: Real-time suggestions with specs search
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    FlatList,
    Pressable,
    ActivityIndicator,
    Platform,
    Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 5;

interface Product {
    id: string;
    name: string;
    slug?: string;
    category?: string;
    price: number;
    image_small: string;
}

interface PopularSearch {
    search_query: string;
    search_count: number;
}

interface SearchAutocompleteProps {
    merchantId?: string;
    onSelectProduct?: (slug: string) => void;
    onSearch?: (query: string) => void;
}

export function SearchAutocomplete({
    merchantId,
    onSelectProduct,
    onSearch,
}: SearchAutocompleteProps) {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<Product[]>([]);
    const [popularSearches, setPopularSearches] = useState<PopularSearch[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<TextInput>(null);

    // Load recent searches on mount
    useEffect(() => {
        loadRecentSearches();
    }, []);

    const loadRecentSearches = async () => {
        try {
            const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
            if (stored) {
                setRecentSearches(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading recent searches:', error);
        }
    };

    const saveRecentSearch = async (searchQuery: string) => {
        try {
            const updated = [
                searchQuery,
                ...recentSearches.filter((s) => s !== searchQuery),
            ].slice(0, MAX_RECENT_SEARCHES);
            await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
            setRecentSearches(updated);
        } catch (error) {
            console.error('Error saving recent search:', error);
        }
    };

    const clearRecentSearches = async () => {
        try {
            await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
            setRecentSearches([]);
        } catch (error) {
            console.error('Error clearing recent searches:', error);
        }
    };

    // Fetch suggestions from API
    const fetchSuggestions = useCallback(
        async (searchQuery: string) => {
            if (searchQuery.length < 2 || !merchantId) {
                setSuggestions([]);
                setPopularSearches([]);
                return;
            }

            setIsLoading(true);
            try {
                // Use the product_autocomplete RPC for fast prefix matching
                const { data: productData, error } = await supabase.rpc(
                    'product_autocomplete',
                    {
                        search_prefix: searchQuery,
                        merchant_id_param: merchantId,
                        result_limit: 7,
                    }
                );

                if (error) throw error;

                // Get popular searches that match
                const { data: popularData } = await supabase
                    .from('popular_searches')
                    .select('search_query, search_count')
                    .eq('merchant_id', merchantId)
                    .ilike('search_query', `%${searchQuery}%`)
                    .order('search_count', { ascending: false })
                    .limit(3);

                setSuggestions(productData || []);
                setPopularSearches(popularData || []);
            } catch (error) {
                console.error('Autocomplete error:', error);
                setSuggestions([]);
                setPopularSearches([]);
            } finally {
                setIsLoading(false);
            }
        },
        [merchantId]
    );

    // Debounced search
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        debounceTimer.current = setTimeout(() => {
            fetchSuggestions(query);
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [query, fetchSuggestions]);

    const handleSubmit = () => {
        if (query.trim()) {
            saveRecentSearch(query.trim());
            onSearch?.(query.trim());
            setIsFocused(false);
            Keyboard.dismiss();
        }
    };

    const handleSelectProduct = (product: Product) => {
        saveRecentSearch(product.name);
        onSelectProduct?.(product.slug || product.id);
        setIsFocused(false);
        setQuery('');
        Keyboard.dismiss();
    };

    const handleSelectRecentSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        onSearch?.(searchQuery);
        setIsFocused(false);
        Keyboard.dismiss();
    };

    const handleSelectPopularSearch = (searchQuery: string) => {
        setQuery(searchQuery);
        saveRecentSearch(searchQuery);
        onSearch?.(searchQuery);
        setIsFocused(false);
        Keyboard.dismiss();
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 0,
        }).format(price);
    };

    const showDropdown =
        isFocused &&
        (query.length >= 2 ||
            recentSearches.length > 0 ||
            popularSearches.length > 0);

    return (
        <View className="w-full relative z-50">
            {/* Search Input */}
            <View className="flex-row items-center bg-white rounded-lg px-3 h-12">
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                    ref={inputRef}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search products, brands and categories"
                    placeholderTextColor="#6B7280"
                    className="flex-1 ml-2 text-[15px] text-gray-900 h-full font-sans"
                    returnKeyType="search"
                    onSubmitEditing={handleSubmit}
                    onFocus={() => setIsFocused(true)}
                    style={Platform.OS === 'web' ? { outline: 'none' } : undefined}
                />
                {isLoading && (
                    <ActivityIndicator size="small" color="#DC2626" />
                )}
                {query.length > 0 && !isLoading && (
                    <Pressable onPress={() => setQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                    </Pressable>
                )}
            </View>

            {/* Dropdown */}
            {showDropdown && (
                <View className="absolute top-14 left-0 right-0 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-96 overflow-hidden z-50">
                    {/* Recent Searches (when no query) */}
                    {query.length < 2 && recentSearches.length > 0 && (
                        <View className="border-b border-gray-100">
                            <View className="flex-row justify-between items-center px-4 pt-3 pb-2">
                                <Text className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                    Recent Searches
                                </Text>
                                <Pressable onPress={clearRecentSearches}>
                                    <Text className="text-xs text-red-600 font-medium">Clear</Text>
                                </Pressable>
                            </View>
                            {recentSearches.map((search, index) => (
                                <Pressable
                                    key={`recent-${index}`}
                                    onPress={() => handleSelectRecentSearch(search)}
                                    className="flex-row items-center px-4 py-3 active:bg-gray-50"
                                >
                                    <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
                                        <Ionicons name="time-outline" size={16} color="#6B7280" />
                                    </View>
                                    <Text className="flex-1 text-sm text-gray-700 font-medium">
                                        {search}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Product Suggestions */}
                    {suggestions.length > 0 && (
                        <View>
                            <Text className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                Products
                            </Text>
                            {suggestions.map((product) => (
                                <Pressable
                                    key={product.id}
                                    onPress={() => handleSelectProduct(product)}
                                    className="flex-row items-center px-4 py-2 active:bg-red-50"
                                >
                                    {product.image_small ? (
                                        <View className="w-10 h-10 bg-gray-100 rounded-lg overflow-hidden mr-3">
                                            <Image
                                                source={{ uri: product.image_small }}
                                                style={{ width: 40, height: 40 }}
                                                contentFit="cover"
                                            />
                                        </View>
                                    ) : (
                                        <View className="w-10 h-10 bg-gray-100 rounded-lg items-center justify-center mr-3">
                                            <Ionicons name="cube-outline" size={20} color="#9CA3AF" />
                                        </View>
                                    )}
                                    <View className="flex-1">
                                        <Text
                                            numberOfLines={1}
                                            className="text-sm font-semibold text-gray-900"
                                        >
                                            {product.name}
                                        </Text>
                                        <View className="flex-row items-center gap-2 mt-0.5">
                                            {product.category && (
                                                <View className="bg-gray-100 rounded-full px-2 py-0.5">
                                                    <Text className="text-[10px] font-medium text-gray-600">
                                                        {product.category}
                                                    </Text>
                                                </View>
                                            )}
                                            <Text className="text-xs font-bold text-red-600">
                                                {formatPrice(product.price)}
                                            </Text>
                                        </View>
                                    </View>
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* Popular Searches */}
                    {popularSearches.length > 0 && (
                        <View className="border-t border-gray-100 mt-2">
                            <Text className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                                Popular Searches
                            </Text>
                            {popularSearches.map((search, index) => (
                                <Pressable
                                    key={`popular-${index}`}
                                    onPress={() => handleSelectPopularSearch(search.search_query)}
                                    className="flex-row items-center px-4 py-3 active:bg-gray-50"
                                >
                                    <View className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center mr-3">
                                        <Ionicons name="trending-up" size={14} color="#6B7280" />
                                    </View>
                                    <Text className="flex-1 text-sm text-gray-700 font-medium">
                                        {search.search_query}
                                    </Text>
                                    {search.search_count > 10 && (
                                        <View className="bg-green-50 rounded-full px-2 py-0.5">
                                            <Text className="text-[10px] font-medium text-green-600">
                                                Trending
                                            </Text>
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    )}

                    {/* No Results */}
                    {query.length >= 2 &&
                        suggestions.length === 0 &&
                        popularSearches.length === 0 &&
                        !isLoading && (
                            <View className="p-6 items-center">
                                <Ionicons name="search-outline" size={32} color="#9CA3AF" />
                                <Text className="text-gray-500 text-sm mt-2">
                                    No results for "{query}"
                                </Text>
                                <Text className="text-gray-400 text-xs mt-1">
                                    Try a different search term
                                </Text>
                            </View>
                        )}
                </View>
            )}

            {/* Backdrop to close dropdown */}
            {showDropdown && (
                <Pressable
                    className="absolute -top-20 -left-20 -right-20 -bottom-96 z-[-1]"
                    onPress={() => {
                        setIsFocused(false);
                        Keyboard.dismiss();
                    }}
                />
            )}
        </View>
    );
}
