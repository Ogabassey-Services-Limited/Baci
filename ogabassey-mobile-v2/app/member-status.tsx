import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/auth-store';

export default function MemberStatusScreen() {
    const insets = useSafeAreaInsets();
    const { customer, isAuthenticated } = useAuthStore();

    // TODO: Fetch member tier from API
    const memberTier = 'Bronze';
    const points = 250;
    const nextTier = 'Silver';
    const pointsToNextTier = 500;

    const tiers = [
        { name: 'Bronze', points: 0, color: '#CD7F32', benefits: ['Free delivery on orders over ₦50,000', '5% cashback'] },
        { name: 'Silver', points: 500, color: '#C0C0C0', benefits: ['Free delivery on orders over ₦30,000', '7% cashback', 'Early access to sales'] },
        { name: 'Gold', points: 2000, color: '#FFD700', benefits: ['Free delivery on all orders', '10% cashback', 'Priority support', 'Exclusive deals'] },
    ];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View
                className="bg-white px-4 pb-4 border-b border-gray-100"
                style={{ paddingTop: insets.top + 16 }}
            >
                <View className="flex-row items-center gap-4">
                    <Pressable onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-xl font-bold text-gray-900">Member Status</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {isAuthenticated ? (
                    <>
                        {/* Current Status */}
                        <View className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl mb-6">
                            <View className="flex-row items-center gap-3 mb-4">
                                <Ionicons name="ribbon" size={32} color="white" />
                                <Text className="text-white text-2xl font-bold">{memberTier} Member</Text>
                            </View>
                            <Text className="text-white/80">You have {points} points</Text>
                            <View className="mt-4 bg-white/20 rounded-full h-2">
                                <View
                                    className="bg-white rounded-full h-2"
                                    style={{ width: `${(points / pointsToNextTier) * 100}%` }}
                                />
                            </View>
                            <Text className="text-white/80 text-sm mt-2">
                                {pointsToNextTier - points} points to {nextTier}
                            </Text>
                        </View>

                        {/* Tiers */}
                        <Text className="text-lg font-bold text-gray-900 mb-4">Membership Tiers</Text>
                        <View className="gap-3">
                            {tiers.map((tier) => (
                                <View key={tier.name} className="bg-white p-4 rounded-xl">
                                    <View className="flex-row items-center gap-3 mb-3">
                                        <Ionicons name="ribbon" size={24} color={tier.color} />
                                        <Text className="font-bold text-gray-900">{tier.name}</Text>
                                        <Text className="text-gray-400 text-sm ml-auto">{tier.points}+ pts</Text>
                                    </View>
                                    <View className="gap-1">
                                        {tier.benefits.map((benefit, i) => (
                                            <View key={i} className="flex-row items-center gap-2">
                                                <Ionicons name="checkmark" size={16} color="#22C55E" />
                                                <Text className="text-gray-600 text-sm">{benefit}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            ))}
                        </View>
                    </>
                ) : (
                    <View className="items-center justify-center py-20">
                        <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="ribbon-outline" size={32} color="#DC2626" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">Sign in to view status</Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            Earn points and unlock rewards as a member.
                        </Text>
                        <Pressable
                            onPress={() => router.push('/login')}
                            className="mt-6 bg-gray-900 py-3 px-6 rounded-xl"
                        >
                            <Text className="text-white font-bold">Sign In</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
