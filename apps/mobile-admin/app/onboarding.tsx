import React, { useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    useWindowDimensions,
    Animated,
    Pressable,
    StatusBar as RNStatusBar,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useOnboarding } from '@/context/OnboardingContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { DARK_COLORS, TYPOGRAPHY, SPACING, RADIUS, SHADOWS } from '@/constants/theme';

// Define types for slides
interface OnboardingSlide {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    subtitle: string;
}

const SLIDES: OnboardingSlide[] = [
    {
        id: '1',
        subtitle: 'AI Store Copilot',
        title: 'Design & Create',
        description: 'Design with AI. Chat to customize your store and SEO instantly.',
        icon: 'storefront',
        color: '#C084FC', // Purple/Pink
    },
    {
        id: '2',
        subtitle: 'Automated Ad Sync',
        title: 'Attract Customers',
        description: '2x Better Ads. Auto-sync sales to Facebook & TikTok APIs.',
        icon: 'megaphone',
        color: '#60A5FA', // Blue/Teal
    },
    {
        id: '3',
        subtitle: 'Process Orders',
        title: 'Fulfill Ease',
        description: 'One-Tap Fulfillment. Dispatch riders and track deliveries.',
        icon: 'cube',
        color: '#FBBF24', // Gold
    },
    {
        id: '4',
        subtitle: 'Real-Time Analytics',
        title: 'Measure Success',
        description: 'Watch Your Growth. Monitor sales and best-sellers live.',
        icon: 'bar-chart',
        color: '#34D399', // Green
    },
    {
        id: '5',
        subtitle: 'Your Store',
        title: 'Freedom in Your Pocket',
        description: 'Manage Everything. Run your entire empire from your phone.',
        icon: 'phone-portrait',
        color: '#3B82F6', // Primary Blue
    },
];

export default function OnboardingScreen() {
    const router = useRouter();
    const { completeOnboarding } = useOnboarding();
    const { width, height } = useWindowDimensions();
    const scrollX = useRef(new Animated.Value(0)).current;
    const slidesRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const viewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems && viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index);
        }
    }).current;

    const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

    const handleComplete = async () => {
        try {
            await completeOnboarding();
            // AuthGate will handle navigation automatically when hasSeenOnboarding becomes true
        } catch (error) {
            console.error('Error saving onboarding status:', error);
        }
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
        } else {
            handleComplete();
        }
    };

    const renderItem = ({ item }: { item: OnboardingSlide }) => {

        return (
            <View style={[styles.slide, { width }]}>
                <View style={styles.contentContainer}>
                    {/* Icon Section with Glow */}
                    <View style={styles.iconContainer}>
                        <View style={[styles.glowRing, { backgroundColor: item.color, opacity: 0.15 }]} />
                        <View style={[styles.glowInner, { backgroundColor: item.color, opacity: 0.1 }]} />
                        <LinearGradient
                            colors={[item.color, 'rgba(255,255,255,0.1)']}
                            style={styles.iconCircle}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name={item.icon} size={48} color="#FFF" />
                        </LinearGradient>
                    </View>

                    {/* Text Content */}
                    <View style={styles.textContainer}>
                        <Text style={[styles.subtitle, { color: item.color }]}>{item.subtitle.toUpperCase()}</Text>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.description}>{item.description}</Text>
                    </View>
                </View>

                {/* Bottom spacer for layout balance */}
                <View style={{ height: height * 0.15 }} />
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Premium Dark Background Gradient */}
            <LinearGradient
                colors={['#0D0D1A', '#1A1A2E', '#0F172A']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            <SafeAreaView style={styles.safeArea}>
                {/* Skip Button - Absolute Top Right */}
                <Pressable
                    style={styles.skipButton}
                    onPress={handleComplete}
                    hitSlop={20}
                >
                    <Text style={styles.skipText}>Skip</Text>
                </Pressable>

                <FlatList
                    data={SLIDES}
                    renderItem={renderItem}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    pagingEnabled
                    bounces={false}
                    keyExtractor={(item) => item.id}
                    onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                        useNativeDriver: false,
                    })}
                    scrollEventThrottle={32}
                    onViewableItemsChanged={viewableItemsChanged}
                    viewabilityConfig={viewConfig}
                    ref={slidesRef}
                />

                {/* Footer Navigation */}
                <View style={styles.footer}>
                    {/* Pagination Indicators */}
                    <View style={styles.paginator}>
                        {SLIDES.map((_, i) => {
                            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];

                            const dotWidth = scrollX.interpolate({
                                inputRange,
                                outputRange: [8, 24, 8],
                                extrapolate: 'clamp',
                            });

                            const opacity = scrollX.interpolate({
                                inputRange,
                                outputRange: [0.3, 1, 0.3],
                                extrapolate: 'clamp',
                            });

                            return (
                                <Animated.View
                                    key={i.toString()}
                                    style={[
                                        styles.dot,
                                        {
                                            width: dotWidth,
                                            opacity,
                                            backgroundColor: i === currentIndex ? SLIDES[i].color : '#FFF',
                                        },
                                    ]}
                                />
                            );
                        })}
                    </View>

                    {/* Action Button */}
                    <Pressable
                        style={({ pressed }) => [
                            styles.buttonContainer,
                            pressed && { transform: [{ scale: 0.98 }] }
                        ]}
                        onPress={handleNext}
                    >
                        <LinearGradient
                            colors={[DARK_COLORS.primary, '#3B82F6']} // Blue gradient
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.button}
                        >
                            <Text style={styles.buttonText}>
                                {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                            </Text>
                            <Ionicons
                                name={currentIndex === SLIDES.length - 1 ? 'rocket-outline' : 'arrow-forward'}
                                size={20}
                                color="#FFF"
                            />
                        </LinearGradient>
                    </Pressable>
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0D0D1A', // Fallback
    },
    safeArea: {
        flex: 1,
    },
    skipButton: {
        position: 'absolute',
        top: Platform.OS === 'android' ? RNStatusBar.currentHeight! + 16 : 60,
        right: 24,
        zIndex: 10,
        padding: 8,
    },
    skipText: {
        color: 'rgba(255,255,255,0.6)',
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.size.sm,
        letterSpacing: 0.5,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: SPACING['3xl'],
    },
    contentContainer: {
        alignItems: 'center',
        width: '100%',
    },
    // Icon Styles
    iconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 200,
        height: 200,
        marginBottom: SPACING['3xl'],
    },
    glowRing: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
    },
    glowInner: {
        position: 'absolute',
        width: 130,
        height: 130,
        borderRadius: 65,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 35, // Squircle-ish
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        ...SHADOWS.lg,
    },

    // Text Styles
    textContainer: {
        alignItems: 'center',
        paddingHorizontal: SPACING.md,
    },
    subtitle: {
        fontFamily: TYPOGRAPHY.fontFamily.bold,
        fontSize: TYPOGRAPHY.size.xs,
        letterSpacing: 2,
        marginBottom: SPACING.sm,
    },
    title: {
        fontFamily: TYPOGRAPHY.fontFamily.bold, // Inter_700Bold
        fontSize: 32,
        color: '#FFF',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: SPACING.lg,
    },
    description: {
        fontFamily: TYPOGRAPHY.fontFamily.medium,
        fontSize: TYPOGRAPHY.size.md,
        color: '#94A3B8', // Muted text
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: '90%',
    },

    // Footer Styles
    footer: {
        paddingHorizontal: SPACING['2xl'],
        paddingBottom: Platform.OS === 'ios' ? 0 : SPACING.xl,
        height: 140, // Fixed height for stable layout
        justifyContent: 'space-between',
    },
    paginator: {
        flexDirection: 'row',
        justifyContent: 'center',
        height: 40,
        marginTop: SPACING.md,
    },
    dot: {
        height: 8,
        borderRadius: 4,
        marginHorizontal: 4,
    },
    buttonContainer: {
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
        ...SHADOWS.md,
        marginBottom: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 18,
        gap: 12,
    },
    buttonText: {
        color: '#FFF',
        fontFamily: TYPOGRAPHY.fontFamily.semiBold,
        fontSize: TYPOGRAPHY.size.lg,
    },
});
