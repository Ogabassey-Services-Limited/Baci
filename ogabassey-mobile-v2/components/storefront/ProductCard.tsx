/**
 * ProductCard Component - NativeWind Edition
 * Matches web's ProductGridItem.tsx design exactly
 */

import { View, Text, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
} from 'react-native-reanimated';
import { useState } from 'react';
import { useCartStore } from '../../stores/cart-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Grid width logic (original)
const GRID_WIDTH = (SCREEN_WIDTH - 48) / 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Product {
    id: string;
    title: string;
    slug: string;
    price: number;
    originalPrice?: number;
    image: string;
    condition?: string;
    rating?: number;
    reviews?: number;
    isCyberDeal?: boolean;
}

interface ProductCardProps {
    product: Product;
    viewMode?: 'grid' | 'list';
}

export function ProductCard({ product, viewMode = 'grid' }: ProductCardProps) {
    const scale = useSharedValue(1);
    const [isFavorite, setIsFavorite] = useState(false);
    const [justAdded, setJustAdded] = useState(false);
    const isList = viewMode === 'list';

    // Cart store integration - get item and addItem function
    const addItem = useCartStore((state) => state.addItem);
    const cartItems = useCartStore((state) => state.items);

    // Calculate quantity of this product in cart
    const cartItem = cartItems.find((item) => item.product_id === product.id);
    const cartQuantity = cartItem?.quantity || 0;
    const isInCart = cartQuantity > 0;

    const handleAddToCart = () => {
        addItem({
            product_id: product.id,
            name: product.title,
            price: product.price,
            compare_at_price: product.originalPrice,
            quantity: 1,
            image_url: product.image,
            condition: product.condition,
        });
        // No toast - just visual feedback via icon change and badge
        // Show checkmark briefly then revert
        setJustAdded(true);
        setTimeout(() => setJustAdded(false), 1500);
    };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const onPressIn = () => {
        scale.value = withSpring(0.98);
    };

    const onPressOut = () => {
        scale.value = withSpring(1);
    };

    const formatPrice = (price: number) => {
        return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
        }).format(price);
    };

    // Dynamic width based on view mode
    const cardWidth = isList ? '100%' : GRID_WIDTH;

    return (
        <AnimatedPressable
            onPress={() => {
                router.push(`/product/${product.slug}`);
            }}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[{ width: cardWidth }, animatedStyle]}
            className={`bg-white rounded-xl mb-4 overflow-hidden border border-gray-100 shadow-sm relative ${isList ? 'flex-row' : ''}`}
        >
            {/* Badges */}
            <View className="absolute top-2 left-2 z-10 flex-row flex-wrap gap-1">
                {product.condition && (
                    <View className="bg-gray-100 px-1.5 py-0.5 rounded-md">
                        <Text className="text-[10px] font-medium text-gray-700 uppercase">
                            {product.condition}
                        </Text>
                    </View>
                )}
                {product.isCyberDeal && (
                    <View className="bg-primary px-1.5 py-0.5 rounded-md">
                        <Text className="text-[10px] font-bold text-primary-foreground uppercase">
                            DEAL
                        </Text>
                    </View>
                )}
            </View>

            {/* Wishlist Button - Adjusted position for list view */}
            <Pressable
                onPress={(e) => {
                    e.stopPropagation();
                    setIsFavorite(!isFavorite);
                }}
                className={`absolute z-20 w-8 h-8 rounded-full bg-white items-center justify-center shadow-sm border border-gray-100 ${isList ? 'top-2 right-2' : 'top-2 right-2'}`}
            >
                <Ionicons
                    name={isFavorite ? "heart" : "heart-outline"}
                    size={18}
                    color={isFavorite ? "#DC2626" : "#1F2937"}
                    className={isFavorite ? "text-primary" : "text-gray-800"}
                />
            </Pressable>

            {/* Product Image Container */}
            <View className={`${isList ? 'w-1/3 h-32' : 'h-40 w-full'} bg-gray-50 p-4 items-center justify-center relative`}>
                <Image
                    source={{ uri: product.image }}
                    contentFit="contain"
                    transition={200}
                    style={{ width: '100%', height: '100%' }}
                    placeholder="L6PZfSi_.AyE_3t7t7RjE1%MWBR*"
                />

                {/* Floating Add Button - Grid View - Matches Web's ProductGridItem */}
                {!isList && (
                    <Pressable
                        className={`absolute bottom-2 right-2 w-10 h-10 rounded-full items-center justify-center shadow-md border z-20 ${justAdded
                            ? 'bg-red-600 border-red-600'
                            : 'bg-white border-gray-100'
                            }`}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleAddToCart();
                        }}
                    >
                        <Ionicons
                            name={justAdded ? "checkmark" : "cart-outline"}
                            size={18}
                            color={justAdded ? "#FFFFFF" : "#111827"}
                        />

                        {/* Quantity Badge */}
                        {cartQuantity > 0 && (
                            <View className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-red-600 rounded-full items-center justify-center border-2 border-white">
                                <Text className="text-white text-[10px] font-bold">
                                    {cartQuantity > 99 ? '99+' : cartQuantity}
                                </Text>
                            </View>
                        )}
                    </Pressable>
                )}
            </View>

            {/* Content */}
            <View className={`p-3 pt-2 ${isList ? 'flex-1 justify-center' : ''}`}>
                <Text
                    numberOfLines={2}
                    className={`text-[14px] font-bold text-gray-900 leading-tight mb-1 font-serif ${isList ? '' : 'h-9'}`}
                >
                    {product.title}
                </Text>

                {/* Rating */}
                <View className="flex-row items-center mb-2">
                    <Ionicons name="star" size={10} color="#F59E0B" className="text-secondary" />
                    <Text className="text-[10px] text-gray-500 ml-1 font-medium">
                        {product.rating} ({product.reviews})
                    </Text>
                </View>

                {/* Price Row */}
                <View className="flex-row items-center justify-between mt-1">
                    <View>
                        <Text className="text-sm font-bold text-gray-900">
                            {formatPrice(product.price)}
                        </Text>
                        {product.originalPrice && product.originalPrice > product.price && (
                            <Text className="text-[10px] text-gray-400 line-through">
                                {formatPrice(product.originalPrice)}
                            </Text>
                        )}
                    </View>

                    {/* Add to Cart button for List View - inline */}
                    {isList && (
                        <Pressable
                            className={`w-8 h-8 rounded-full items-center justify-center ${justAdded ? 'bg-red-600' : 'bg-gray-900'
                                }`}
                            onPress={(e) => {
                                e.stopPropagation();
                                handleAddToCart();
                            }}
                        >
                            <Ionicons
                                name={justAdded ? "checkmark" : "cart-outline"}
                                size={16}
                                color="white"
                            />

                            {/* Quantity Badge for List View */}
                            {cartQuantity > 0 && (
                                <View className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 bg-red-600 rounded-full items-center justify-center border border-white">
                                    <Text className="text-white text-[8px] font-bold">
                                        {cartQuantity > 99 ? '99+' : cartQuantity}
                                    </Text>
                                </View>
                            )}
                        </Pressable>
                    )}
                </View>
            </View>
        </AnimatedPressable>
    );
}

