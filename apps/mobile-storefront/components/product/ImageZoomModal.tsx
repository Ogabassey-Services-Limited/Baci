/**
 * Image Zoom Modal Component
 * Provides pinch-to-zoom and double-tap-to-zoom functionality for product images
 * Uses react-native-gesture-handler and react-native-reanimated for smooth animations
 */

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BLURHASH_VARIANTS } from '@/components/storefront/ProductCard';
import { RADIUS, SHADOWS, SPACING, SPRING_CONFIG } from '@/constants/Colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

interface ImageZoomModalProps {
  visible: boolean;
  images: string[];
  initialIndex: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function ImageZoomModal({
  visible,
  images,
  initialIndex,
  onClose,
  onIndexChange,
}: ImageZoomModalProps) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Animated values for zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Reset transform values
  const resetTransform = () => {
    scale.set(withSpring(1, SPRING_CONFIG.snappy));
    translateX.set(withSpring(0, SPRING_CONFIG.snappy));
    translateY.set(withSpring(0, SPRING_CONFIG.snappy));
    savedScale.set(1);
    savedTranslateX.set(0);
    savedTranslateY.set(0);
  };

  // Handle index change with JS callback
  const handleIndexChange = (index: number) => {
    setCurrentIndex(index);
    onIndexChange?.(index);
  };

  // Navigate to previous image
  const goToPrevious = () => {
    if (currentIndex > 0) {
      resetTransform();
      handleIndexChange(currentIndex - 1);
    }
  };

  // Navigate to next image
  const goToNext = () => {
    if (currentIndex < images.length - 1) {
      resetTransform();
      handleIndexChange(currentIndex + 1);
    }
  };

  // Clamp translation based on scale
  const clampTranslation = (
    value: number,
    dimension: number,
    currentScale: number
  ) => {
    // biome-ignore lint/suspicious/noExplicitAny: Reanimated worklet directive
    'worklet';
    const scaledDimension = dimension * currentScale;
    const maxTranslate = Math.max(0, (scaledDimension - dimension) / 2);
    return Math.min(Math.max(value, -maxTranslate), maxTranslate);
  };

  // Pinch gesture for zoom
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      savedScale.set(scale.get());
    })
    .onUpdate((event) => {
      const newScale = savedScale.get() * event.scale;
      scale.set(Math.min(Math.max(newScale, MIN_SCALE * 0.5), MAX_SCALE));
      focalX.set(event.focalX);
      focalY.set(event.focalY);
    })
    .onEnd(() => {
      // Snap back if below minimum scale
      if (scale.get() < MIN_SCALE) {
        scale.set(withSpring(MIN_SCALE, SPRING_CONFIG.snappy));
        translateX.set(withSpring(0, SPRING_CONFIG.snappy));
        translateY.set(withSpring(0, SPRING_CONFIG.snappy));
      }
      savedScale.set(scale.get());
    });

  // Pan gesture for moving zoomed image
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
    })
    .onUpdate((event) => {
      if (scale.get() > 1) {
        // Allow panning when zoomed
        const newX = savedTranslateX.get() + event.translationX;
        const newY = savedTranslateY.get() + event.translationY;
        translateX.set(clampTranslation(newX, SCREEN_WIDTH, scale.get()));
        translateY.set(clampTranslation(newY, SCREEN_HEIGHT, scale.get()));
      } else {
        // When not zoomed, allow horizontal swipe for image navigation
        translateX.set(event.translationX * 0.5);
      }
    })
    .onEnd((event) => {
      if (scale.get() <= 1) {
        // Handle swipe navigation
        const threshold = SCREEN_WIDTH * 0.25;
        const velocity = event.velocityX;

        if (
          (translateX.get() > threshold || velocity > 500) &&
          currentIndex > 0
        ) {
          runOnJS(goToPrevious)();
        } else if (
          (translateX.get() < -threshold || velocity < -500) &&
          currentIndex < images.length - 1
        ) {
          runOnJS(goToNext)();
        }

        // Reset position
        translateX.set(withSpring(0, SPRING_CONFIG.snappy));
        translateY.set(withSpring(0, SPRING_CONFIG.snappy));
      } else {
        // Clamp final position when zoomed
        translateX.set(
          withSpring(
            clampTranslation(translateX.get(), SCREEN_WIDTH, scale.get()),
            SPRING_CONFIG.snappy
          )
        );
        translateY.set(
          withSpring(
            clampTranslation(translateY.get(), SCREEN_HEIGHT, scale.get()),
            SPRING_CONFIG.snappy
          )
        );
      }
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
    });

  // Double tap gesture for zoom toggle
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > 1) {
        // Zoom out
        scale.set(withSpring(1, SPRING_CONFIG.snappy));
        translateX.set(withSpring(0, SPRING_CONFIG.snappy));
        translateY.set(withSpring(0, SPRING_CONFIG.snappy));
        savedScale.set(1);
        savedTranslateX.set(0);
        savedTranslateY.set(0);
      } else {
        // Zoom in to tap location
        const targetScale = DOUBLE_TAP_SCALE;
        scale.set(withSpring(targetScale, SPRING_CONFIG.snappy));

        // Calculate offset to zoom into tap position
        const centerX = SCREEN_WIDTH / 2;
        const centerY = SCREEN_HEIGHT / 2;
        const offsetX = (centerX - event.x) * (targetScale - 1);
        const offsetY = (centerY - event.y) * (targetScale - 1);

        translateX.set(
          withSpring(
            clampTranslation(offsetX, SCREEN_WIDTH, targetScale),
            SPRING_CONFIG.snappy
          )
        );
        translateY.set(
          withSpring(
            clampTranslation(offsetY, SCREEN_HEIGHT, targetScale),
            SPRING_CONFIG.snappy
          )
        );
        savedScale.set(targetScale);
        savedTranslateX.set(translateX.get());
        savedTranslateY.set(translateY.get());
      }
    });

  // Single tap to toggle UI visibility (close modal)
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      // Only close if not zoomed
      if (scale.get() <= 1.1) {
        runOnJS(onClose)();
      }
    });

  // Combine gestures with proper priority
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(panGesture, singleTapGesture)
    )
  );

  // Animated style for the image
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  // Reset when modal opens/closes or index changes
  const handleModalOpen = () => {
    setCurrentIndex(initialIndex);
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
    savedScale.set(1);
    savedTranslateX.set(0);
    savedTranslateY.set(0);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      onShow={handleModalOpen}
      statusBarTranslucent
      accessibilityViewIsModal
    >
      <View style={styles.container}>
        {/* Background */}
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.backdrop}
        />

        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300).delay(100)}
          style={[styles.header, { paddingTop: insets.top + SPACING.sm }]}
        >
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={12}
            accessibilityLabel="Close image viewer"
            accessibilityRole="button"
            accessibilityHint="Double tap to close the full screen image viewer"
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </Pressable>

          {images.length > 1 && (
            <View style={styles.counter}>
              <Text style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Zoomable Image */}
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={styles.imageWrapper}>
            <Animated.View style={[styles.imageContainer, animatedImageStyle]}>
              <Image
                source={{ uri: images[currentIndex] }}
                style={styles.image}
                contentFit="contain"
                transition={200}
                placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
                cachePolicy="memory-disk"
                accessibilityLabel={`Product image ${currentIndex + 1} of ${images.length}`}
              />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        {/* Navigation Arrows (only show when not zoomed) */}
        {images.length > 1 && (
          <>
            {currentIndex > 0 && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.navButton, styles.navLeft]}
              >
                <Pressable
                  onPress={goToPrevious}
                  style={styles.navButtonInner}
                  hitSlop={16}
                  accessibilityLabel="Previous image"
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-back" size={32} color="#FFF" />
                </Pressable>
              </Animated.View>
            )}
            {currentIndex < images.length - 1 && (
              <Animated.View
                entering={FadeIn.duration(200)}
                style={[styles.navButton, styles.navRight]}
              >
                <Pressable
                  onPress={goToNext}
                  style={styles.navButtonInner}
                  hitSlop={16}
                  accessibilityLabel="Next image"
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-forward" size={32} color="#FFF" />
                </Pressable>
              </Animated.View>
            )}
          </>
        )}

        {/* Thumbnail Strip */}
        {images.length > 1 && (
          <Animated.View
            entering={FadeIn.duration(300).delay(200)}
            style={[
              styles.thumbnailStrip,
              { paddingBottom: insets.bottom + SPACING.md },
            ]}
          >
            <Animated.ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailContainer}
            >
              {images.map((img, idx) => (
                <Pressable
                  key={idx}
                  onPress={() => {
                    resetTransform();
                    handleIndexChange(idx);
                  }}
                  style={[
                    styles.thumbnail,
                    currentIndex === idx && styles.thumbnailActive,
                  ]}
                  accessibilityLabel={`Go to image ${idx + 1}`}
                  accessibilityRole="button"
                >
                  <Image
                    source={{ uri: img }}
                    style={styles.thumbnailImage}
                    contentFit="cover"
                    placeholder={{ blurhash: BLURHASH_VARIANTS.default }}
                    transition={150}
                    cachePolicy="memory-disk"
                  />
                </Pressable>
              ))}
            </Animated.ScrollView>
          </Animated.View>
        )}

        {/* Zoom Hint */}
        <Animated.View
          entering={FadeIn.duration(300).delay(500)}
          style={styles.hint}
        >
          <Text style={styles.hintText}>Pinch or double-tap to zoom</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  counterText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -28,
    zIndex: 5,
  },
  navLeft: {
    left: SPACING.sm,
  },
  navRight: {
    right: SPACING.sm,
  },
  navButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.md,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  thumbnailContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.6,
  },
  thumbnailActive: {
    borderColor: '#FFF',
    opacity: 1,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '500',
  },
});
