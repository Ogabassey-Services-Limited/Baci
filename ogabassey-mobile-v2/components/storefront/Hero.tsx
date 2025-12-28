import { View, Text, FlatList, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect } from 'react';
import { router } from 'expo-router';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
    id: number;
    type: 'image' | 'video' | 'ad';
    title?: string;
    subtitle?: string;
    bgClass?: string;
    src?: string;
    poster?: string;
    textColor?: string;
    imageFit?: 'contain' | 'cover';
}

const MOBILE_SLIDES: Slide[] = [
    {
        id: 1,
        type: 'image',
        title: 'iPhone 17 Pro',
        subtitle: 'Beyond IMAGINATION with the new nebula finish.',
        bgClass: 'bg-[#F5F5F7]',
        src: 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-bluetitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80',
        textColor: 'text-gray-900',
        imageFit: 'contain',
    },
    {
        id: 2,
        type: 'video',
        title: 'Cinematic Mode',
        subtitle: 'Shoot like a pro. Auto-focus changes dynamically.',
        bgClass: 'bg-black',
        src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        textColor: 'text-white',
        imageFit: 'cover',
    },
    {
        id: 3,
        type: 'ad',
        bgClass: 'bg-gray-50',
    },
];

export function Hero() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const videoRef = useRef<Video>(null);

    // Auto-scroll logic (matches web 6000ms)
    useEffect(() => {
        const activeSlide = MOBILE_SLIDES[currentSlide];
        if (activeSlide?.type === 'ad') return; // Don't rotate ad automatically for now

        const timer = setTimeout(() => {
            const nextIndex = (currentSlide + 1) % MOBILE_SLIDES.length;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentSlide(nextIndex);
        }, 6000);

        return () => clearTimeout(timer);
    }, [currentSlide]);

    const renderSlide = ({ item }: { item: Slide }) => {
        return (
            <View
                style={{ width: SCREEN_WIDTH - 32 }}
                className={`h-48 rounded-2xl overflow-hidden relative mx-4 mt-4 ${item.bgClass}`}
            >
                {/* TYPE: IMAGE */}
                {item.type === 'image' && (
                    <>
                        <View className="relative h-full flex items-start p-6 z-10 w-[60%]">
                            <View>
                                <Text className={`text-2xl font-extrabold leading-tight mb-2 font-sans ${item.textColor}`}>
                                    {item.title}
                                </Text>
                                <Text className={`text-[11px] font-medium leading-relaxed opacity-90 ${item.textColor}`}>
                                    {item.subtitle}
                                </Text>
                                <Pressable
                                    onPress={() => router.push('/search?q=iphone')}
                                    className={`mt-3 px-4 py-2 rounded-full border self-start ${item.textColor === 'text-white' ? 'bg-white/20 border-white/30' : 'bg-black/5 border-black/10'}`}
                                >
                                    <Text className={`text-[10px] font-bold ${item.textColor}`}>
                                        Shop Now
                                    </Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Image positioning matches web: contain right */}
                        <View className="absolute right-[-20px] bottom-0 top-0 w-[55%]">
                            <Image
                                source={{ uri: item.src }}
                                contentFit="contain"
                                style={{ width: '100%', height: '100%' }}
                            />
                        </View>
                    </>
                )}

                {/* TYPE: VIDEO */}
                {item.type === 'video' && (
                    <View className="flex-1 justify-center relative w-full h-full">
                        <Video
                            ref={videoRef}
                            style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: 0 }}
                            source={{
                                uri: item.src || '',
                            }}
                            useNativeControls={false}
                            resizeMode={ResizeMode.COVER}
                            isLooping
                            shouldPlay={true}
                            isMuted={true}
                        />
                        {/* Gradient Overlay for text readability */}
                        <LinearGradient
                            colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.7)']}
                            style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 1 }}
                        />

                        <View className="p-6 relative z-10 w-full h-full justify-center">
                            <View className="bg-red-600 px-2 py-0.5 rounded-full self-start mb-2">
                                <Text className="text-white text-[9px] font-bold uppercase tracking-wider">
                                    Live Demo
                                </Text>
                            </View>
                            <Text className="text-white text-2xl font-extrabold leading-tight mb-1">
                                {item.title}
                            </Text>
                            <Text className="text-white/90 text-xs mb-3">
                                {item.subtitle}
                            </Text>
                            <Pressable className="flex-row items-center bg-white px-4 py-2 rounded-full self-start">
                                <Ionicons name="play" size={10} color="black" />
                                <Text className="text-black text-[10px] font-bold ml-1">
                                    Watch
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* TYPE: AD */}
                {item.type === 'ad' && (
                    <View className="flex-1 items-center justify-center">
                        <View className="absolute top-2 right-2 px-1 rounded border border-gray-200">
                            <Text className="text-[8px] text-gray-400">Sponsored</Text>
                        </View>
                        <Text className="text-gray-400 font-bold">AD SPACE</Text>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View className="w-full bg-white pb-4">
            {/* Background Extension (Black top section matching header) */}
            <View className="absolute top-0 left-0 right-0 h-14 bg-[#0F0F0F] z-0" />

            <FlatList
                ref={flatListRef}
                data={MOBILE_SLIDES}
                renderItem={({ item }) => (
                    <View style={{ width: SCREEN_WIDTH }} className="items-center">
                        {renderSlide({ item })}
                    </View>
                )}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id.toString()}
                onMomentumScrollEnd={(ev) => {
                    const newIndex = Math.round(ev.nativeEvent.contentOffset.x / SCREEN_WIDTH);
                    setCurrentSlide(newIndex);
                }}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
                onScrollToIndexFailed={(info) => {
                    const wait = new Promise((resolve) => setTimeout(resolve, 500));
                    wait.then(() => {
                        flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
                    });
                }}
            />

            {/* Indicators */}
            <View className="flex-row justify-center gap-1.5 mt-4">
                {MOBILE_SLIDES.map((slide, idx) => {
                    const isActive = currentSlide === idx;
                    return (
                        <View
                            key={slide.id}
                            className={`h-1.5 rounded-full transition-all ${isActive ? 'w-5 bg-gray-900' : 'w-1.5 bg-gray-300'
                                }`}
                        />
                    );
                })}
            </View>
        </View>
    );
}
