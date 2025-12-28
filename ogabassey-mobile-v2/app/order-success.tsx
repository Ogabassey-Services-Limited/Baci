import { View, Text, Pressable, ScrollView, Image, Linking, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { supabase } from '@/lib/supabase';

export default function OrderSuccess() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams();
    const clearCart = useCartStore(state => state.clearCart);

    const [reviewUrl, setReviewUrl] = useState<string | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // Clear cart on mount if successful
    useEffect(() => {
        clearCart();
    }, []);

    const orderId = params.orderId as string;
    const merchantId = params.merchantId as string;
    const isPending = params.pending === 'true';
    const paymentType = params.type as string;

    useEffect(() => {
        if (!merchantId) return;

        // OGABASSEY SPECIFIC FALLBACK
        const OGABASSEY_ID = '6b5cb8a4-5575-456c-b936-8cdfae30db74';

        async function fetchMerchantSettings() {
            setLoadingSettings(true);
            try {
                // Pre-set for Ogabassey if using that ID (Common in mobile app)
                if (merchantId === OGABASSEY_ID) {
                    // Fallback link that opens properly on mobile
                    setReviewUrl('https://www.google.com/search?q=Ogabassey+Ikeja+reviews&oq=Ogabassey+reviews');
                }

                const { data, error } = await supabase
                    .from('merchants')
                    .select('feature_settings')
                    .eq('id', merchantId)
                    .single();

                if (data && data.feature_settings) {
                    const settings = data.feature_settings as any;
                    // Check for google_place_id (for Maps link) - Overwrites fallback if exists and valid
                    if (settings.google_place_id) {
                        setReviewUrl(`https://search.google.com/local/writereview?placeid=${settings.google_place_id}`);
                    }
                }
            } catch (err) {
                console.error("Failed to fetch merchant settings:", err);
            } finally {
                setLoadingSettings(false);
            }
        }

        fetchMerchantSettings();
    }, [merchantId]);


    return (
        <View className="flex-1 bg-white">
            <ScrollView
                contentContainerStyle={{
                    flexGrow: 1,
                    paddingTop: insets.top + 40,
                    paddingHorizontal: 20,
                    alignItems: 'center'
                }}
            >
                <View className="mb-8 items-center">
                    {/* Dynamic Icon based on payment status */}
                    <View className={`w-24 h-24 ${isPending ? 'bg-orange-100' : 'bg-green-100'} rounded-full items-center justify-center mb-6 shadow-sm`}>
                        <Ionicons
                            name={isPending ? "time-outline" : "checkmark"}
                            size={50}
                            color={isPending ? "#ea580c" : "#16a34a"}
                        />
                    </View>

                    <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
                        {isPending ? 'Payment Pending' : 'Order Confirmed!'}
                    </Text>
                    <Text className="text-gray-500 text-center text-lg mb-8">
                        {isPending
                            ? 'Your order is saved. We\'ll confirm once payment is received.'
                            : 'Thank you for your purchase. Your order has been received.'
                        }
                    </Text>

                    {orderId && (
                        <View className="bg-gray-50 px-6 py-4 rounded-xl border border-gray-100 w-full mb-8">
                            <Text className="text-gray-500 text-center text-sm mb-1 uppercase tracking-wide">Order ID</Text>
                            <Text className="text-gray-900 text-center text-2xl font-mono font-bold">#{orderId.slice(0, 8).toUpperCase()}</Text>
                        </View>
                    )}

                    {/* Crypto Pending Warning */}
                    {isPending && paymentType === 'crypto' && (
                        <View className="w-full bg-orange-50 p-4 rounded-xl mb-4 flex-row items-start border border-orange-200">
                            <Ionicons name="wallet-outline" size={24} color="#ea580c" style={{ marginRight: 12, marginTop: 2 }} />
                            <View className="flex-1">
                                <Text className="font-bold text-orange-800 mb-1">Awaiting Crypto Payment</Text>
                                <Text className="text-orange-700 text-sm">
                                    Once your USDT payment is confirmed on the blockchain, your order will be processed automatically.
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Trust Signals */}
                    <View className="w-full bg-blue-50 p-4 rounded-xl mb-4 flex-row items-start">
                        <Ionicons name="mail-outline" size={24} color="#2563eb" style={{ marginRight: 12, marginTop: 2 }} />
                        <View className="flex-1">
                            <Text className="font-bold text-blue-800 mb-1">Check your email</Text>
                            <Text className="text-blue-600 text-sm">
                                {isPending
                                    ? 'We\'ll send a confirmation email once your payment is verified.'
                                    : 'We\'ve sent a confirmation email with your order details and tracking information.'
                                }
                            </Text>
                        </View>
                    </View>

                    <View className="w-full bg-yellow-50 p-4 rounded-xl mb-8 flex-row items-start">
                        <Ionicons name="time-outline" size={24} color="#ca8a04" style={{ marginRight: 12, marginTop: 2 }} />
                        <View className="flex-1">
                            <Text className="font-bold text-yellow-800 mb-1">Processing Time</Text>
                            <Text className="text-yellow-700 text-sm">
                                {isPending
                                    ? 'Crypto payments typically confirm within 1-30 minutes depending on network.'
                                    : 'Your order will be processed within 24 hours. You\'ll be notified when it ships.'
                                }
                            </Text>
                        </View>
                    </View>

                    {/* Google Reviews - Only show for confirmed orders */}
                    {!isPending && reviewUrl && (
                        <Pressable
                            onPress={() => Linking.openURL(reviewUrl)}
                            className="w-full bg-white border border-gray-200 p-4 rounded-xl mb-8 flex-row items-center justify-center shadow-sm"
                        >
                            <Ionicons name="logo-google" size={24} color="#DB4437" style={{ marginRight: 12 }} />
                            <Text className="font-bold text-gray-700">Rate us on Google</Text>
                        </Pressable>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Action */}
            <View className="p-4 border-t border-gray-100" style={{ paddingBottom: Math.max(insets.bottom, 20) }}>
                <Pressable
                    onPress={() => router.replace('/(tabs)')}
                    className="w-full bg-red-600 py-4 rounded-full items-center justify-center shadow-lg shadow-red-200"
                >
                    <Text className="text-white font-bold text-lg">Continue Shopping</Text>
                </Pressable>
            </View>
        </View>
    );
}

