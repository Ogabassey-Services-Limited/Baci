import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SwapScreen() {
    const insets = useSafeAreaInsets();

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
                    <Text className="text-xl font-bold text-gray-900">Swap / Trade-In</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {/* Hero Card */}
                <View className="bg-gradient-to-br from-red-600 to-red-700 p-6 rounded-2xl mb-6">
                    <Ionicons name="swap-horizontal" size={40} color="white" />
                    <Text className="text-white text-2xl font-bold mt-4">Trade in your old device</Text>
                    <Text className="text-white/80 mt-2">
                        Get instant value for your old phone and upgrade to a new one.
                    </Text>
                </View>

                {/* Steps */}
                <View className="bg-white p-4 rounded-xl mb-4">
                    <Text className="font-bold text-gray-900 mb-4">How it works</Text>
                    {[
                        { step: 1, title: 'Select your device', desc: 'Choose the device you want to trade in' },
                        { step: 2, title: 'Get a quote', desc: "We'll assess and give you a fair value" },
                        { step: 3, title: 'Ship or drop off', desc: 'Send your device to us' },
                        { step: 4, title: 'Get paid', desc: 'Receive credit or cash for your device' },
                    ].map((item) => (
                        <View key={item.step} className="flex-row items-start gap-4 mb-4">
                            <View className="w-8 h-8 bg-red-100 rounded-full items-center justify-center">
                                <Text className="text-red-600 font-bold">{item.step}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="font-semibold text-gray-900">{item.title}</Text>
                                <Text className="text-gray-500 text-sm">{item.desc}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                <Pressable className="bg-red-600 py-4 rounded-xl">
                    <Text className="text-white font-bold text-center">Start Trade-In</Text>
                </Pressable>
            </ScrollView>
        </View>
    );
}
