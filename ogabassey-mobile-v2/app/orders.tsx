import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function OrdersScreen() {
    const insets = useSafeAreaInsets();

    // TODO: Fetch orders from API
    const orders: any[] = [];

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
                    <Text className="text-xl font-bold text-gray-900">My Orders</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {orders.length > 0 ? (
                    orders.map((order) => (
                        <View key={order.id} className="bg-white p-4 rounded-xl mb-3">
                            <Text className="font-semibold">{order.id}</Text>
                        </View>
                    ))
                ) : (
                    <View className="items-center justify-center py-20">
                        <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="bag-outline" size={32} color="#DC2626" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">No orders yet</Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            Your orders will appear here once you make a purchase.
                        </Text>
                        <Pressable
                            onPress={() => router.push('/')}
                            className="mt-6 bg-gray-900 py-3 px-6 rounded-xl"
                        >
                            <Text className="text-white font-bold">Start Shopping</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
