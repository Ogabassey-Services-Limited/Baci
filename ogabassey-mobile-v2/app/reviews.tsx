import { View, Text, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReviewsScreen() {
    const insets = useSafeAreaInsets();

    // TODO: Fetch reviews from API
    const reviews: any[] = [];

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
                    <Text className="text-xl font-bold text-gray-900">My Reviews</Text>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }}>
                {reviews.length > 0 ? (
                    reviews.map((review) => (
                        <View key={review.id} className="bg-white p-4 rounded-xl mb-3">
                            <View className="flex-row items-center gap-1 mb-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                    <Ionicons
                                        key={star}
                                        name={star <= review.rating ? 'star' : 'star-outline'}
                                        size={16}
                                        color="#F59E0B"
                                    />
                                ))}
                            </View>
                            <Text className="text-gray-900">{review.content}</Text>
                        </View>
                    ))
                ) : (
                    <View className="items-center justify-center py-20">
                        <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-4">
                            <Ionicons name="star-outline" size={32} color="#DC2626" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">No reviews yet</Text>
                        <Text className="text-gray-500 mt-2 text-center px-8">
                            Purchase a product and leave a review to help other customers.
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
