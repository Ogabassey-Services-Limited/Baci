import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';

export default function RepairsScreen() {
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');

    // TODO: Fetch repair history from API
    const repairs: any[] = [];

    return (
        <View className="flex-1 bg-gray-50">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View
                className="bg-white px-4 pb-4 border-b border-gray-100"
                style={{ paddingTop: insets.top + 16 }}
            >
                <View className="flex-row items-center gap-4 mb-4">
                    <Pressable onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </Pressable>
                    <Text className="text-xl font-bold text-gray-900">Repairs</Text>
                </View>

                {/* Tabs */}
                <View className="flex-row gap-2">
                    <Pressable
                        onPress={() => setActiveTab('request')}
                        className={`flex-1 py-2 rounded-lg ${activeTab === 'request' ? 'bg-red-600' : 'bg-gray-100'}`}
                    >
                        <Text className={`text-center font-medium ${activeTab === 'request' ? 'text-white' : 'text-gray-600'}`}>
                            New Request
                        </Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setActiveTab('history')}
                        className={`flex-1 py-2 rounded-lg ${activeTab === 'history' ? 'bg-red-600' : 'bg-gray-100'}`}
                    >
                        <Text className={`text-center font-medium ${activeTab === 'history' ? 'text-white' : 'text-gray-600'}`}>
                            History
                        </Text>
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {activeTab === 'request' ? (
                    <View className="gap-4">
                        <View className="bg-white p-4 rounded-xl">
                            <Text className="text-gray-700 font-medium mb-2">Device Type</Text>
                            <View className="flex-row gap-2">
                                {['Phone', 'Tablet', 'Laptop', 'Other'].map((type) => (
                                    <Pressable key={type} className="bg-gray-100 px-4 py-2 rounded-lg">
                                        <Text className="text-gray-700">{type}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>

                        <View className="bg-white p-4 rounded-xl">
                            <Text className="text-gray-700 font-medium mb-2">Describe the issue</Text>
                            <TextInput
                                multiline
                                numberOfLines={4}
                                placeholder="Tell us what's wrong with your device..."
                                placeholderTextColor="#9CA3AF"
                                className="bg-gray-50 px-4 py-3 rounded-lg text-gray-900"
                                textAlignVertical="top"
                            />
                        </View>

                        <Pressable className="bg-red-600 py-4 rounded-xl">
                            <Text className="text-white font-bold text-center">Submit Repair Request</Text>
                        </Pressable>
                    </View>
                ) : (
                    repairs.length > 0 ? (
                        repairs.map((repair) => (
                            <View key={repair.id} className="bg-white p-4 rounded-xl mb-3">
                                <Text className="font-semibold">{repair.device}</Text>
                            </View>
                        ))
                    ) : (
                        <View className="items-center justify-center py-20">
                            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                                <Ionicons name="build-outline" size={32} color="#DC2626" />
                            </View>
                            <Text className="text-lg font-bold text-gray-900">No repair history</Text>
                            <Text className="text-gray-500 mt-2 text-center">
                                Submit a repair request to get started.
                            </Text>
                        </View>
                    )
                )}
            </ScrollView>
        </View>
    );
}
