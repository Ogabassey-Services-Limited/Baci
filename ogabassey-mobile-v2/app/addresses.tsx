import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddressesScreen() {
    const insets = useSafeAreaInsets();

    // TODO: Fetch addresses from API
    const addresses: any[] = [];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View
                className="bg-white px-4 pb-4 border-b border-gray-100"
                style={{ paddingTop: insets.top + 16 }}
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4">
                        <Pressable onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="#111827" />
                        </Pressable>
                        <Text className="text-xl font-bold text-gray-900">Address Book</Text>
                    </View>
                    <Pressable className="bg-red-600 p-2 rounded-lg">
                        <Ionicons name="add" size={20} color="white" />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {addresses.length > 0 ? (
                    addresses.map((address) => (
                        <View key={address.id} className="bg-white p-4 rounded-xl mb-3">
                            <Text className="font-semibold">{address.name}</Text>
                        </View>
                    ))
                ) : (
                    <View className="items-center justify-center py-20">
                        <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="location-outline" size={32} color="#DC2626" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">No addresses saved</Text>
                        <Text className="text-gray-500 mt-2 text-center">
                            Add an address for faster checkout.
                        </Text>
                        <Pressable className="mt-6 bg-gray-900 py-3 px-6 rounded-xl">
                            <Text className="text-white font-bold">Add Address</Text>
                        </Pressable>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
