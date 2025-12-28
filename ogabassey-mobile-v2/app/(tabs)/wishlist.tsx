import { View, Text, ScrollView, Pressable, StatusBar } from 'react-native';
import { useWishlistStore } from '../../stores/wishlist-store';
import { ProductCard } from '../../components/storefront/ProductCard';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../components/storefront/Header';

export default function Wishlist() {
    const { items, clearWishlist } = useWishlistStore();

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
            <StatusBar barStyle="dark-content" />

            <View className="px-5 py-4 border-b border-gray-100 flex-row justify-between items-center bg-white">
                <Text className="text-xl font-bold text-gray-900 font-serif">Wishlist</Text>
                {items.length > 0 && (
                    <Pressable onPress={clearWishlist}>
                        <Text className="text-destructive font-medium text-sm">Clear All</Text>
                    </Pressable>
                )}
            </View>

            <ScrollView contentContainerStyle={{ padding: 16 }} className="flex-1 bg-gray-50">
                {items.length === 0 ? (
                    <View className="items-center justify-center py-20">
                        <View className="w-20 h-20 rounded-full items-center justify-center mb-6 relative overflow-hidden bg-red-50">
                            <Ionicons name="heart-outline" size={32} color="var(--primary)" className="text-primary" />
                        </View>
                        <Text className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</Text>
                        <Text className="text-gray-500 text-center mb-8 px-8">
                            Save items you love to your wishlist for later.
                        </Text>
                        <Link href="/(tabs)/" asChild>
                            <Pressable className="bg-primary px-8 py-3 rounded-full shadow-lg">
                                <Text className="text-primary-foreground font-bold text-base">Start Exploring</Text>
                            </Pressable>
                        </Link>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap justify-between">
                        {items.map((item) => (
                            <ProductCard
                                key={item.id}
                                product={{
                                    id: item.id,
                                    title: item.name,
                                    slug: item.slug,
                                    price: item.price,
                                    // Missing fields will be undefined or defaulted in Card
                                    image: item.image,
                                }}
                                viewMode="grid"
                            />
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
