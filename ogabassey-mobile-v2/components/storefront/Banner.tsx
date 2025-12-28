
import { View, Text, FlatList, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, useRef } from 'react';
import Animated, { useSharedValue } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BannerSlide {
    id: number;
    imageUrl: string;
    title: string;
    subtitle: string;
    bgColor: string;
    textColor: string;
    link?: string;
}

const BANNER_SLIDES: BannerSlide[] = [
    {
        id: 1,
        imageUrl: 'https://cdn.ogabassey.com/products/flash-sale-banner.avif',
        title: 'Flash Sale',
        subtitle: 'Up to 50% Off Selected Items',
        bgColor: 'bg-red-600',
        textColor: 'text-white',
    },
    {
        id: 3,
        imageUrl: 'https://cdn.ogabassey.com/products/new-arrivals-banner.avif',
        title: 'New Arrivals',
        subtitle: 'Check out the latest tech',
        bgColor: 'bg-black',
        textColor: 'text-white',
    },
    // Added a third dummy slide for demonstration
    {
        id: 4,
        imageUrl: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2070&auto=format&fit=crop',
        title: 'Gaming Week',
        subtitle: 'Level up your setup',
        bgColor: 'bg-purple-900',
        textColor: 'text-white',
    }
];

export function Banner() {
    const [activeIndex, setActiveIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setActiveIndex(viewableItems[0].index || 0);
        }
    }).current;

    const viewabilityConfig = useRef({
        itemVisiblePercentThreshold: 50,
    }).current;

    const renderItem = ({ item }: { item: BannerSlide }) => (
        <View style={{ width: SCREEN_WIDTH - 32, height: 160 }} className="mr-4 overflow-hidden rounded-2xl relative bg-gray-100">
            <Image
                source={{ uri: item.imageUrl }}
                contentFit="cover"
                transition={300}
                style={{ width: '100%', height: '100%' }}
            />

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '100%', justifyContent: 'flex-end', padding: 20 }}
            >
                <Text className="text-white font-bold text-2xl font-serif mb-1">
                    {item.title}
                </Text>
                <Text className="text-gray-200 text-sm font-medium">
                    {item.subtitle}
                </Text>

                <Pressable className="mt-3 bg-white px-4 py-2 rounded-full self-start active:bg-gray-200">
                    <Text className="text-black text-xs font-bold uppercase">Shop Now</Text>
                </Pressable>
            </LinearGradient>
        </View>
    );

    return (
        <View className="mb-6 px-4">
            {/* Header */}
            {/* <View className="flex-row items-center justify-between mb-3 px-1">
             <Text className="text-lg font-bold text-gray-900 font-serif">Trending</Text>
         </View> */}

            <FlatList
                ref={flatListRef}
                data={BANNER_SLIDES}
                renderItem={renderItem}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SCREEN_WIDTH - 16} // Width + margin roughly
                decelerationRate="fast"
                snapToAlignment="start"
                contentContainerStyle={{ paddingRight: 16 }} // Gap for last item
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
            />

            {/* Dots Indicator */}
            <View className="flex-row justify-center mt-3 gap-1.5">
                {BANNER_SLIDES.map((_, index) => (
                    <View
                        key={index}
                        className={`h-1.5 rounded-full transition-all ${activeIndex === index ? 'w-6 bg-red-600' : 'w-1.5 bg-gray-300'
                            }`}
                    />
                ))}
            </View>
        </View>
    );
}
