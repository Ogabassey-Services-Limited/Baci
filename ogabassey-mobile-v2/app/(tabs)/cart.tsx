import { View, Text, ScrollView, Pressable, ActivityIndicator, StatusBar, Alert, Modal, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../../hooks/use-cart';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

interface NegotiationState {
    isOpen: boolean;
    type: 'single' | 'total';
    itemId?: string;
    currentPrice: number;
    name: string;
}

export default function Cart() {
    const {
        items,
        cartTotal,
        subtotal,
        updateQuantity,
        removeFromCart,
        isLoading,
        toggleAssurance,
        applyNegotiatedPrice,
        applyCartDiscount,
    } = useCart();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [negotiationState, setNegotiationState] = useState<NegotiationState | null>(null);
    const [offerPrice, setOfferPrice] = useState('');

    // Warning Modal State
    const [showNegotiateWarning, setShowNegotiateWarning] = useState(false);
    const [pendingNegotiateItem, setPendingNegotiateItem] = useState<any>(null);

    // Arrow animation
    const arrowX = useSharedValue(0);

    useEffect(() => {
        arrowX.value = withRepeat(
            withTiming(6, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [arrowX]);

    const arrowAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: arrowX.value }],
    }));

    const handleCheckout = () => {
        console.log('[Cart] handleCheckout called, items:', items.length);
        if (items.length === 0) {
            Alert.alert('Cart Empty', 'Please add items to your cart first.');
            return;
        }
        // Navigate to checkout
        console.log('[Cart] Navigating to /checkout...');
        router.push('/checkout');
    };

    // Helper function to actually open item negotiation
    const actuallyOpenItemNegotiation = (item: any) => {
        const price = item.negotiatedPrice ?? item.price;
        setNegotiationState({
            isOpen: true,
            type: 'single',
            itemId: item.id,
            currentPrice: price * item.quantity,
            name: item.quantity > 1 ? `${item.name} (x${item.quantity})` : item.name,
        });
        setOfferPrice('');
    };

    const openItemNegotiation = (item: any) => {
        // Check if any item already has individual negotiation
        const hasAnyIndividualNegotiation = items.some(i => i.negotiatedPrice != null);

        // Check if cart-wide discount is active (bulk mode)
        const hasBulkDiscount = items.some(i => i.cartDiscount && i.cartDiscount > 0);

        if (hasBulkDiscount) {
            // Bulk mode is active, block individual negotiation
            Alert.alert(
                'Bulk Negotiation Active',
                'You already have a bulk discount applied to your cart. Remove the bulk discount before negotiating items individually.',
                [{ text: 'OK', style: 'default' }]
            );
            return;
        }

        if (hasAnyIndividualNegotiation) {
            // Already using individual mode, proceed directly
            actuallyOpenItemNegotiation(item);
        } else {
            // First negotiation - show warning modal
            setPendingNegotiateItem(item);
            setShowNegotiateWarning(true);
        }
    };

    const openTotalNegotiation = () => {
        setNegotiationState({
            isOpen: true,
            type: 'total',
            currentPrice: cartTotal,
            name: 'Entire Cart',
        });
        setOfferPrice('');
    };

    const handleSubmitOffer = () => {
        if (!negotiationState) return;
        const offer = parseFloat(offerPrice.replace(/,/g, ''));
        if (isNaN(offer) || offer <= 0) {
            Alert.alert('Invalid Offer', 'Please enter a valid price.');
            return;
        }

        if (negotiationState.type === 'single' && negotiationState.itemId) {
            // Find the item to calculate unit price
            const item = items.find(i => i.id === negotiationState.itemId);
            if (item) {
                const newUnitPrice = offer / item.quantity;
                applyNegotiatedPrice(item.id, newUnitPrice);
            }
        } else if (negotiationState.type === 'total') {
            // Apply cart-wide discount (difference between current and offer)
            const discount = subtotal - offer;
            if (discount > 0) {
                applyCartDiscount(discount);
            }
        }

        Alert.alert(
            'Offer Applied! 🎉',
            `Your offer of ₦${offer.toLocaleString()} has been applied.`,
            [{ text: 'OK', onPress: () => setNegotiationState(null) }]
        );
    };

    if (isLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#DC2626" />
            </View>
        );
    }

    if (items.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center p-6">
                <StatusBar barStyle="dark-content" />
                <View className="bg-red-50 w-24 h-24 rounded-full items-center justify-center mb-6">
                    <Ionicons name="cart-outline" size={48} color="#DC2626" />
                </View>
                <Text className="text-xl font-bold text-gray-900 mb-2">Your cart is empty 🤧</Text>
                <Text className="text-gray-500 text-center mb-8">
                    Looks like you haven't added anything to your cart yet.
                </Text>
                <Link href="/(tabs)/" asChild>
                    <Pressable className="bg-gray-900 px-8 py-3.5 rounded-xl">
                        <Text className="text-white font-bold text-base">Start Shopping</Text>
                    </Pressable>
                </Link>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View className="px-5 py-4 border-b border-gray-100 flex-row justify-between items-center bg-white">
                <View className="flex-row items-center gap-2">
                    <Ionicons name="cart" size={24} color="#DC2626" />
                    <Text className="text-xl font-bold text-gray-900">Cart</Text>
                    <Text className="text-gray-400 text-lg">({items.length})</Text>
                </View>
                <Link href="/(tabs)/" asChild>
                    <Pressable>
                        <Text className="text-red-600 font-medium text-sm">Continue Shopping</Text>
                    </Pressable>
                </Link>
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 200 }}>
                <View className="p-4 gap-4">
                    {items.map((item) => {
                        const price = item.negotiatedPrice ?? item.price;
                        const itemTotal = price * item.quantity;
                        const hasAssurance = item.hasAssurance || false;
                        const assuranceCost = hasAssurance ? itemTotal * 0.05 : 0;

                        return (
                            <View
                                key={`${item.product_id}-${item.variant_id || 'base'}`}
                                className="bg-white rounded-2xl p-4 border border-gray-100"
                            >
                                {/* Top Row: Image & Info */}
                                <View className="flex-row gap-4">
                                    <View className="w-20 h-20 bg-gray-50 rounded-xl items-center justify-center p-2">
                                        <Image
                                            source={{ uri: item.image_url }}
                                            style={{ width: '100%', height: '100%' }}
                                            contentFit="contain"
                                        />
                                    </View>

                                    <View className="flex-1 pr-6">
                                        <Text className="text-sm font-bold text-gray-900" numberOfLines={2}>
                                            {item.name}
                                        </Text>
                                        <View className="flex-row flex-wrap gap-1 mt-2">
                                            <View className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                                <Text className="text-[9px] font-bold text-emerald-700 uppercase">NEW</Text>
                                            </View>
                                            {item.variant_name && (
                                                <View className="bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                    <Text className="text-[10px] text-gray-600">{item.variant_name}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>

                                    {/* Remove Button */}
                                    <Pressable
                                        onPress={() => removeFromCart(item.id)}
                                        className="absolute top-4 right-4 p-1.5"
                                    >
                                        <Ionicons name="trash-outline" size={16} color="#DC2626" />
                                    </Pressable>
                                </View>

                                {/* Separator */}
                                <View className="my-3 border-t border-dashed border-gray-100" />

                                {/* Middle Row: Quantity & Price */}
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center bg-gray-50 rounded-lg border border-gray-200">
                                        <Pressable
                                            onPress={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                                            className="px-3 py-2 border-r border-gray-200"
                                        >
                                            <Ionicons name="remove" size={14} color="#6B7280" />
                                        </Pressable>
                                        <Text className="w-8 text-center text-sm font-bold text-gray-900">
                                            {item.quantity}
                                        </Text>
                                        <Pressable
                                            onPress={() => updateQuantity(item.id, item.quantity + 1)}
                                            className="px-3 py-2 border-l border-gray-200"
                                        >
                                            <Ionicons name="add" size={14} color="#6B7280" />
                                        </Pressable>
                                    </View>

                                    {/* Price Display */}
                                    {item.negotiatedPrice ? (
                                        <View className="items-end">
                                            <Text className="text-xs text-gray-400 line-through">
                                                ₦{(item.price * item.quantity).toLocaleString()}
                                            </Text>
                                            <Text className="text-lg font-bold text-green-600">
                                                ₦{itemTotal.toLocaleString()}
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text className="text-lg font-bold text-gray-900">
                                            ₦{itemTotal.toLocaleString()}
                                        </Text>
                                    )}
                                </View>

                                {/* Bottom Row: Assurance & Negotiate */}
                                <View className="mt-4 pt-3 border-t border-gray-100 flex-row justify-between items-center">
                                    {/* Assurance Toggle */}
                                    <Pressable
                                        onPress={() => toggleAssurance(item.id)}
                                        className="flex-row items-start gap-2 flex-1"
                                    >
                                        <View className={`w-9 h-5 rounded-full ${hasAssurance ? 'bg-red-600' : 'bg-gray-200'} justify-center`}>
                                            <View className={`w-3.5 h-3.5 bg-white rounded-full mx-0.5 ${hasAssurance ? 'ml-auto mr-0.5' : ''}`} />
                                        </View>
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-1">
                                                <Ionicons name="shield-checkmark" size={12} color="#DC2626" />
                                                <Text className="text-xs font-bold text-gray-800">Assurance</Text>
                                            </View>
                                            {hasAssurance ? (
                                                <Text className="text-[10px]">
                                                    <Text className="text-gray-500">Screen & Liquid </Text>
                                                    <Text className="font-bold text-green-600">+₦{assuranceCost.toLocaleString()}</Text>
                                                </Text>
                                            ) : (
                                                <Text className="text-[10px] text-gray-500">Device Protection (+5%)</Text>
                                            )}
                                        </View>
                                    </Pressable>

                                    {/* Negotiate Button */}
                                    <Pressable
                                        onPress={() => openItemNegotiation(item)}
                                        className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg border border-red-100 active:bg-red-50"
                                    >
                                        <Ionicons name="cash-outline" size={14} color="#DC2626" />
                                        <Text className="text-xs font-bold text-red-600">Negotiate</Text>
                                    </Pressable>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Sticky Footer */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-[100]"
                style={{ paddingBottom: Math.max((insets.bottom || 20) * 0.3, 6), paddingTop: 12, paddingHorizontal: 16 }}
            >
                <View className="flex-row gap-3">
                    {/* Bulk Negotiate Button */}
                    <Pressable
                        onPress={openTotalNegotiation}
                        className="w-14 h-14 bg-gray-100 rounded-xl items-center justify-center border border-gray-200"
                    >
                        <Ionicons name="cash-outline" size={20} color="#DC2626" />
                        <Text className="text-[9px] font-bold text-gray-600 mt-0.5">Bulk</Text>
                    </Pressable>

                    {/* Checkout Button */}
                    <Pressable
                        onPress={() => {
                            if (items.length === 0) {
                                Alert.alert('Cart Empty', 'Add items first.');
                                return;
                            }
                            // Try navigate instead of push
                            router.navigate('/checkout');
                        }}
                        className="flex-1 bg-red-600 rounded-xl flex-row items-center justify-center gap-2 py-4 active:opacity-90"
                    >
                        <Text className="text-white font-bold">Checkout</Text>
                        <Text className="text-white/80">•</Text>
                        <Text className="text-white font-bold">₦{cartTotal.toLocaleString()}</Text>
                        <Animated.View style={arrowAnimatedStyle}>
                            <Ionicons name="arrow-forward" size={18} color="white" />
                        </Animated.View>
                    </Pressable>
                </View>
            </View>

            {/* Negotiation Modal */}
            <Modal
                visible={negotiationState?.isOpen || false}
                transparent
                animationType="slide"
                onRequestClose={() => setNegotiationState(null)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-3xl p-6">
                        <View className="flex-row items-center justify-between mb-6">
                            <Text className="text-xl font-bold text-gray-900">Make an Offer</Text>
                            <Pressable onPress={() => setNegotiationState(null)}>
                                <Ionicons name="close" size={24} color="#6B7280" />
                            </Pressable>
                        </View>

                        <View className="bg-gray-50 p-4 rounded-xl mb-4">
                            <Text className="text-gray-600 text-sm mb-1">Negotiating for:</Text>
                            <Text className="font-bold text-gray-900">{negotiationState?.name}</Text>
                            <Text className="text-gray-500 mt-2">
                                Current Price: <Text className="font-bold text-gray-900">₦{negotiationState?.currentPrice.toLocaleString()}</Text>
                            </Text>
                        </View>

                        <Text className="text-gray-700 font-medium mb-2">Your Offer (₦)</Text>
                        <TextInput
                            value={offerPrice}
                            onChangeText={setOfferPrice}
                            placeholder="Enter your best price"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="number-pad"
                            className="bg-gray-50 px-4 py-3.5 rounded-xl text-lg font-bold text-gray-900 border border-gray-200 mb-4"
                        />

                        <Pressable
                            onPress={handleSubmitOffer}
                            className="bg-red-600 py-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-bold text-lg">Submit Offer</Text>
                        </Pressable>

                        <Text className="text-center text-xs text-gray-400 mt-4">
                            The seller will review your offer and respond within 24 hours.
                        </Text>
                    </View>
                </View>
            </Modal>

            {/* Negotiation Warning Modal */}
            <Modal
                visible={showNegotiateWarning}
                transparent
                animationType="slide"
                onRequestClose={() => setShowNegotiateWarning(false)}
            >
                <View className="flex-1 bg-black/60 justify-end">
                    <View className="bg-white rounded-t-3xl p-6 pb-10">
                        {/* Header */}
                        <View className="flex-row items-center justify-between mb-6">
                            <View className="flex-row items-center gap-3">
                                <View className="w-12 h-12 bg-amber-100 rounded-full items-center justify-center">
                                    <Ionicons name="alert-circle" size={24} color="#D97706" />
                                </View>
                                <Text className="text-xl font-bold text-gray-900">Negotiation Mode</Text>
                            </View>
                            <Pressable onPress={() => setShowNegotiateWarning(false)} className="bg-gray-100 p-2 rounded-full">
                                <Ionicons name="close" size={20} color="#6B7280" />
                            </Pressable>
                        </View>

                        {/* Content */}
                        <Text className="text-gray-600 text-base leading-6 mb-8">
                            Negotiating items individually will disable bulk cart negotiation.
                            <Text className="font-bold text-gray-900"> You can only use one approach.</Text>
                        </Text>

                        {/* Actions */}
                        <View className="gap-3">
                            <Pressable
                                onPress={() => {
                                    if (pendingNegotiateItem) {
                                        actuallyOpenItemNegotiation(pendingNegotiateItem);
                                        setShowNegotiateWarning(false);
                                        setPendingNegotiateItem(null);
                                    }
                                }}
                                className="bg-red-600 py-4 rounded-xl items-center flex-row justify-center gap-2"
                            >
                                <Ionicons name="pricetag" size={20} color="white" />
                                <Text className="text-white font-bold text-lg">Negotiate This Item</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setShowNegotiateWarning(false);
                                    setPendingNegotiateItem(null);
                                    openTotalNegotiation();
                                }}
                                className="bg-gray-100 py-4 rounded-xl items-center flex-row justify-center gap-2"
                            >
                                <Ionicons name="layers" size={20} color="#374151" />
                                <Text className="text-gray-800 font-bold text-lg">Bulk Negotiate Cart</Text>
                            </Pressable>

                            <Pressable
                                onPress={() => {
                                    setShowNegotiateWarning(false);
                                    setPendingNegotiateItem(null);
                                }}
                                className="py-2 items-center"
                            >
                                <Text className="text-gray-500 font-medium text-base">Cancel</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

