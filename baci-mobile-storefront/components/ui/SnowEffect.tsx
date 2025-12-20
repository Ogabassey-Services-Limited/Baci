import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
    cancelAnimation
} from 'react-native-reanimated';
import { useThemeStore } from '@/stores/theme-store';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_SNOWFLAKES = 50;

const Snowflake = ({ index }: { index: number }) => {
    const xPosition = Math.random() * SCREEN_WIDTH;
    const startY = -Math.random() * 100; // Start above screen
    const duration = 5000 + Math.random() * 5000; // 5-10s duration
    const delay = Math.random() * 5000;
    const size = Math.random() * 4 + 2; // 2-6px size

    const translateY = useSharedValue(startY);
    const opacity = useSharedValue(0.8);

    useEffect(() => {
        translateY.value = withDelay(
            delay,
            withRepeat(
                withTiming(SCREEN_HEIGHT + 100, {
                    duration: duration,
                    easing: Easing.linear
                }),
                -1 // Infinite repeat
            )
        );

        // Optional: Twinkle/Fade effect
        opacity.value = withRepeat(
            withTiming(0.4, { duration: duration / 2 }),
            -1,
            true
        );

        return () => {
            cancelAnimation(translateY);
            cancelAnimation(opacity);
        };
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
        opacity: opacity.value,
    }));

    return (
        <Animated.View
            style={[
                styles.snowflake,
                {
                    left: xPosition,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                },
                animatedStyle,
            ]}
        />
    );
};

export function SnowEffect() {
    const theme = useThemeStore((state) => state.theme);

    if (theme !== 'santa') return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {Array.from({ length: NUM_SNOWFLAKES }).map((_, i) => (
                <Snowflake key={i} index={i} />
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999, // On top of everything
        elevation: 9999,
    },
    snowflake: {
        position: 'absolute',
        backgroundColor: 'white',
        top: 0,
    },
});
