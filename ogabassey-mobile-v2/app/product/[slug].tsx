import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RenderHtml from 'react-native-render-html';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef } from 'react';
import Animated, { FadeIn, FadeInDown, SlideInDown } from 'react-native-reanimated';
import { useProduct } from '../../hooks/use-products';
import { useCart } from '../../hooks/use-cart';
import { formatPrice } from '../../types/product';
import React from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProductDetailScreen() {
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const router = useRouter();
    const { product, isLoading, error } = useProduct(slug || '');
    const { addToCart, isAddingToCart, updateQuantity, removeFromCart, getItem, items } = useCart();

    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
    const insets = useSafeAreaInsets();

    // Get quantity of this product in cart
    const cartItem = product ? getItem(product.id) : null;
    const quantityInCart = cartItem?.quantity || 0;

    // Initialize default attributes
    React.useEffect(() => {
        if (product?.variant_attributes) {
            const defaults: Record<string, string> = {};
            Object.entries(product.variant_attributes).forEach(([key, values]) => {
                if (Array.isArray(values) && values.length > 0) {
                    defaults[key] = values[0];
                }
            });
            setSelectedAttributes(defaults);
        }
    }, [product]);

    const scrollRef = useRef<ScrollView>(null);

    if (isLoading) {
        return (
            <View className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="var(--primary)" />
            </View>
        );
    }

    if (error || !product) {
        return (
            <View className="flex-1 bg-white items-center justify-center p-6">
                <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
                <Text className="text-lg font-bold text-gray-900 mt-4 text-center">Product Not Found</Text>
                <Text className="text-gray-500 text-center mt-2 mb-6">The product you are looking for does not exist or has been removed.</Text>
                <Pressable
                    onPress={() => router.back()}
                    className="bg-gray-900 px-6 py-3 rounded-full"
                >
                    <Text className="text-white font-bold">Go Back</Text>
                </Pressable>
            </View>
        );
    }

    const handleScroll = (event: any) => {
        const slideSize = event.nativeEvent.layoutMeasurement.width;
        const index = event.nativeEvent.contentOffset.x / slideSize;
        setActiveImageIndex(Math.round(index));
    };

    const images = product.images && product.images.length > 0
        ? product.images
        : [product.image];

    const handleAddToCart = () => {
        addToCart({
            product_id: product.id,
            quantity: 1, // Always add 1 when clicking the button
            price: product.price,
            // Variant logic would go here
        });
    };

    return (
        <View className="flex-1 bg-white">
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className={`absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-4 ${Platform.OS === 'ios' ? 'pt-14' : 'pt-10'}`}>
                <Pressable
                    onPress={() => router.back()}
                    className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full items-center justify-center shadow-sm"
                >
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </Pressable>
                <View className="flex-row gap-3">
                    <Pressable className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full items-center justify-center shadow-sm">
                        <Ionicons name="share-outline" size={22} color="#111827" />
                    </Pressable>
                    <Pressable
                        onPress={() => router.push('/(tabs)/cart')}
                        className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full items-center justify-center shadow-sm relative"
                    >
                        <Ionicons name="cart-outline" size={22} color="#111827" />
                        {items.length > 0 && (
                            <View
                                className="absolute -top-1 -right-1 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: '#dc2626',
                                    minWidth: 18,
                                    height: 18,
                                    paddingHorizontal: 4
                                }}
                            >
                                <Text className="text-[10px] font-bold text-white">
                                    {items.reduce((total, item) => total + item.quantity, 0)}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                </View>
            </View>

            <ScrollView className="flex-1">
                {/* Image Gallery */}
                <View className="relative bg-gray-50">
                    <ScrollView
                        ref={scrollRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={handleScroll}
                        scrollEventThrottle={16}
                        className="w-full h-[400px]"
                    >
                        {images.map((img, index) => (
                            <View key={index} style={{ width: SCREEN_WIDTH, height: 400 }} className="justify-center items-center p-8">
                                <Image
                                    source={{ uri: img }}
                                    contentFit="contain"
                                    style={{ width: '100%', height: '100%' }}
                                    transition={300}
                                />
                            </View>
                        ))}
                    </ScrollView>

                    {/* Pagination Dots */}
                    {images.length > 1 && (
                        <View className="absolute bottom-4 left-0 right-0 flex-row justify-center gap-2">
                            {images.map((_, index) => (
                                <View
                                    key={index}
                                    className={`h-2 rounded-full transition-all ${activeImageIndex === index ? 'w-6 bg-gray-900' : 'w-2 bg-gray-300'
                                        }`}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* Product Info */}
                <Animated.View
                    entering={FadeInDown.duration(500).delay(200)}
                    className="pt-6"
                    style={{ paddingBottom: insets.bottom + 100, paddingHorizontal: 14 }}
                >
                    {/* Brand & Rating */}
                    <View className="flex-row justify-between items-center mb-2">
                        {product.brand && (
                            <Text className="text-sm font-semibold text-primary uppercase tracking-wider">
                                {product.brand}
                            </Text>
                        )}
                        <View className="flex-row items-center bg-gray-100 px-2 py-1 rounded-md">
                            <Ionicons name="star" size={14} color="#F59E0B" />
                            <Text className="text-xs font-bold ml-1 text-gray-900">{product.rating || 4.5}</Text>
                            <Text className="text-xs text-gray-500 ml-1">({product.review_count || 0} reviews)</Text>
                        </View>
                    </View>

                    {/* Title */}
                    <Text className="text-2xl font-bold text-gray-900 font-serif leading-tight mb-2">
                        {product.name}
                    </Text>

                    {/* Price */}
                    <View className="flex-row items-end gap-3 mb-6">
                        <Text className="text-3xl font-bold text-gray-900">
                            {formatPrice(product.price)}
                        </Text>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                            <Text className="text-lg text-gray-400 line-through mb-1">
                                {formatPrice(product.compare_at_price)}
                            </Text>
                        )}
                        {product.compare_at_price && product.compare_at_price > product.price && (
                            <View className="bg-red-100 px-2 py-1 rounded-md mb-2">
                                <Text className="text-xs font-bold text-red-700">
                                    Save {Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}%
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Variants */}
                    {product.variant_attributes && Object.entries(product.variant_attributes).map(([key, values]) => (
                        <View key={key} className="mb-6">
                            <Text className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wide">{key}</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                {Array.isArray(values) && values.map((value) => {
                                    const isSelected = selectedAttributes[key] === value;
                                    return (
                                        <Pressable
                                            key={value}
                                            onPress={() => setSelectedAttributes(prev => ({ ...prev, [key]: value }))}
                                            className={`mr-3 px-4 py-2 rounded-lg border ${isSelected
                                                ? 'bg-gray-900 border-gray-900'
                                                : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            <Text className={`font-medium ${isSelected ? 'text-white' : 'text-gray-700'
                                                }`}>
                                                {value}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    ))}

                    {/* Condition & Stock */}
                    <View className="flex-row gap-3 mb-8">
                        <View className="border border-gray-200 rounded-lg px-3 py-2 self-start">
                            <Text className="text-xs text-gray-500 uppercase mb-0.5">Condition</Text>
                            <Text className="text-sm font-semibold text-gray-900">
                                {product.condition || 'Brand New'}
                            </Text>
                        </View>
                        <View className="border border-gray-200 rounded-lg px-3 py-2 self-start">
                            <Text className="text-xs text-gray-500 uppercase mb-0.5">Availability</Text>
                            <Text className={`${product.in_stock !== false ? 'text-green-600' : 'text-red-500'} text-sm font-semibold`}>
                                {product.in_stock !== false ? 'In Stock' : 'Out of Stock'}
                            </Text>
                        </View>
                    </View>

                    {/* Divider */}
                    <View className="h-[1px] bg-gray-100 w-full mb-6" />

                    {/* Description */}
                    {/* Description */}
                    <Text className="text-lg font-bold text-gray-900 mb-3">Description</Text>
                    <View>
                        <RenderHtml
                            contentWidth={SCREEN_WIDTH - 40}
                            source={{ html: product.description || '<p>No description available for this product.</p>' }}
                            baseStyle={{ color: '#4B5563', fontSize: 16, lineHeight: 24 }}
                            tagsStyles={{
                                p: { marginBottom: 10, color: '#4B5563' },
                                ul: { marginBottom: 10 },
                                li: { marginBottom: 4, color: '#4B5563' },
                                h1: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, color: '#111827' },
                                h2: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, color: '#111827' },
                                h3: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#111827' },
                            }}
                        />
                    </View>

                </Animated.View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <Animated.View
                entering={SlideInDown.duration(500).delay(400)}
                className="absolute bottom-0 left-0 right-0"
                style={{
                    backgroundColor: '#ffffff',
                    borderTopWidth: 1,
                    borderTopColor: '#e5e7eb',
                    paddingTop: 16,
                    paddingBottom: 22,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                }}
            >
                <View className="flex-row gap-4 px-5">
                    {quantityInCart > 0 ? (
                        /* Quantity Controls + View Cart - when product is in cart */
                        <>
                            <View
                                className="flex-row items-center justify-between rounded-xl h-14"
                                style={{ borderWidth: 2, borderColor: '#dc2626', flex: 1 }}
                            >
                                <Pressable
                                    onPress={() => {
                                        if (quantityInCart === 1) {
                                            if (cartItem) removeFromCart(cartItem.id);
                                        } else {
                                            if (cartItem) updateQuantity(cartItem.id, quantityInCart - 1);
                                        }
                                    }}
                                    className="w-14 h-full items-center justify-center"
                                    style={{ borderRightWidth: 1, borderRightColor: '#fecaca' }}
                                >
                                    <Ionicons
                                        name={quantityInCart === 1 ? "trash-outline" : "remove"}
                                        size={20}
                                        color="#dc2626"
                                    />
                                </Pressable>
                                <View className="flex-1 items-center justify-center">
                                    <Text className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">In Cart</Text>
                                    <Text className="text-lg font-bold text-gray-900">{quantityInCart}</Text>
                                </View>
                                <Pressable
                                    onPress={() => {
                                        if (cartItem) updateQuantity(cartItem.id, quantityInCart + 1);
                                    }}
                                    className="w-14 h-full items-center justify-center"
                                    style={{ borderLeftWidth: 1, borderLeftColor: '#fecaca' }}
                                >
                                    <Ionicons name="add" size={20} color="#dc2626" />
                                </Pressable>
                            </View>
                            {/* View Cart Button */}
                            <Pressable
                                onPress={() => router.push('/(tabs)/cart')}
                                className="rounded-xl items-center justify-center shadow-lg shadow-black/10 flex-row gap-2 h-14 bg-primary"
                                style={{ flex: 1 }}
                            >
                                <Ionicons name="cart" size={20} color="white" />
                                <Text className="text-white font-bold text-base">View Cart</Text>
                            </Pressable>
                        </>
                    ) : (
                        /* Add to Cart Button - full width when not in cart */
                        <Pressable
                            onPress={handleAddToCart}
                            disabled={isAddingToCart}
                            className={`flex-1 rounded-xl items-center justify-center shadow-lg shadow-black/10 flex-row gap-2 h-14 ${isAddingToCart ? 'bg-gray-400' : 'bg-primary'}`}
                        >
                            {isAddingToCart ? (
                                <ActivityIndicator color="var(--primary-foreground)" />
                            ) : (
                                <>
                                    <Ionicons name="cart" size={20} color="var(--primary-foreground)" />
                                    <Text className="text-primary-foreground font-bold text-lg">Add to Cart</Text>
                                </>
                            )}
                        </Pressable>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}
