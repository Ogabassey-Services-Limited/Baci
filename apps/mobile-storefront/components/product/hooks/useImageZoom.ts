/**
 * useImageZoom Hook
 * Encapsulates all gesture and animation logic for the ImageZoomModal.
 * Handles pinch-to-zoom, pan, double-tap-to-zoom, and swipe navigation.
 */

import type { ViewStyle } from 'react-native';
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  type AnimatedStyle,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SPRING_CONFIG } from '@/constants/Colors';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

export interface UseImageZoomParams {
  onClose: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  currentIndex: number;
  totalImages: number;
}

export interface UseImageZoomReturn {
  composedGesture: ReturnType<typeof Gesture.Simultaneous>;
  animatedImageStyle: AnimatedStyle<ViewStyle>;
  resetTransform: () => void;
  resetTransformImmediate: () => void;
}

export function useImageZoom({
  onClose,
  goToPrevious,
  goToNext,
  currentIndex,
  totalImages,
}: UseImageZoomParams): UseImageZoomReturn {
  // Reactive dimensions — update on device rotation
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Animated shared values for zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Clamp translation based on scale — must run on the UI thread
  const clampTranslation = (
    value: number,
    dimension: number,
    currentScale: number
  ) => {
    'worklet';
    const scaledDimension = dimension * currentScale;
    const maxTranslate = Math.max(0, (scaledDimension - dimension) / 2);
    return Math.min(Math.max(value, -maxTranslate), maxTranslate);
  };

  // Animated spring reset (used when navigating between images)
  const resetTransform = () => {
    scale.set(withSpring(1, SPRING_CONFIG.snappy));
    translateX.set(withSpring(0, SPRING_CONFIG.snappy));
    translateY.set(withSpring(0, SPRING_CONFIG.snappy));
    savedScale.set(1);
    savedTranslateX.set(0);
    savedTranslateY.set(0);
  };

  // Immediate reset (used when modal opens or index resets without animation)
  const resetTransformImmediate = () => {
    scale.set(1);
    translateX.set(0);
    translateY.set(0);
    savedScale.set(1);
    savedTranslateX.set(0);
    savedTranslateY.set(0);
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
        savedScale.set(MIN_SCALE);
        savedTranslateX.set(0);
        savedTranslateY.set(0);
      } else {
        savedScale.set(scale.get());
      }
    });

  // Pan gesture for moving the zoomed image or swiping between images
  const panGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      savedTranslateX.set(translateX.get());
      savedTranslateY.set(translateY.get());
    })
    .onUpdate((event) => {
      if (scale.get() > 1) {
        // Allow panning when zoomed in
        const newX = savedTranslateX.get() + event.translationX;
        const newY = savedTranslateY.get() + event.translationY;
        translateX.set(clampTranslation(newX, screenWidth, scale.get()));
        translateY.set(clampTranslation(newY, screenHeight, scale.get()));
      } else {
        // When not zoomed, allow horizontal swipe for image navigation
        translateX.set(event.translationX * 0.5);
      }
    })
    .onEnd((event) => {
      if (scale.get() <= 1) {
        // Handle swipe navigation
        const threshold = screenWidth * 0.25;
        const velocity = event.velocityX;

        if (
          (translateX.get() > threshold || velocity > 500) &&
          currentIndex > 0
        ) {
          runOnJS(goToPrevious)();
        } else if (
          (translateX.get() < -threshold || velocity < -500) &&
          currentIndex < totalImages - 1
        ) {
          runOnJS(goToNext)();
        }

        // Reset position after swipe attempt
        translateX.set(withSpring(0, SPRING_CONFIG.snappy));
        translateY.set(withSpring(0, SPRING_CONFIG.snappy));
        savedTranslateX.set(0);
        savedTranslateY.set(0);
      } else {
        // Clamp final position when zoomed — compute target values first
        const clampedX = clampTranslation(
          translateX.get(),
          screenWidth,
          scale.get()
        );
        const clampedY = clampTranslation(
          translateY.get(),
          screenHeight,
          scale.get()
        );
        translateX.set(withSpring(clampedX, SPRING_CONFIG.snappy));
        translateY.set(withSpring(clampedY, SPRING_CONFIG.snappy));
        // Store the clamped target values, not in-flight animation values
        savedTranslateX.set(clampedX);
        savedTranslateY.set(clampedY);
      }
    });

  // Double-tap gesture to toggle zoom level
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.get() > 1) {
        // Zoom out to fit
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

        // Calculate offset so tap position becomes the new focal centre
        const centerX = screenWidth / 2;
        const centerY = screenHeight / 2;
        const offsetX = (centerX - event.x) * (targetScale - 1);
        const offsetY = (centerY - event.y) * (targetScale - 1);

        // Compute clamped target values before animating
        const clampedX = clampTranslation(offsetX, screenWidth, targetScale);
        const clampedY = clampTranslation(offsetY, screenHeight, targetScale);
        translateX.set(withSpring(clampedX, SPRING_CONFIG.snappy));
        translateY.set(withSpring(clampedY, SPRING_CONFIG.snappy));
        savedScale.set(targetScale);
        // Store the clamped target values, not in-flight animation values
        savedTranslateX.set(clampedX);
        savedTranslateY.set(clampedY);
      }
    });

  // Single-tap gesture to close the modal when not zoomed
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.get() <= 1.1) {
        runOnJS(onClose)();
      }
    });

  // Compose all gestures with correct priority
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(
      doubleTapGesture,
      Gesture.Simultaneous(panGesture, singleTapGesture)
    )
  );

  // Animated style applied to the image container
  const animatedImageStyle: AnimatedStyle<ViewStyle> = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: scale.get() },
    ],
  }));

  return {
    composedGesture,
    animatedImageStyle,
    resetTransform,
    resetTransformImmediate,
  };
}
