import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { GestureHandlerRuntime } from '@/lib/optional-gesture-handler';
import { EDGE_MARGIN, FAB_SIZE } from './constants';
import {
  getAnchoredFabTranslationX,
  getClampedFabTranslationY,
} from './use-draggable-fab-position';

// Define completely static, immutable haptic trigger outside the hook
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(style).catch(() => undefined);
  }
};

export function useDraggableFab(
  bottomOffset: number,
  onDismiss?: () => void,
  onPress?: () => void,
  gestureRuntime?: Pick<GestureHandlerRuntime, 'Gesture'>
) {
  const Gesture = gestureRuntime?.Gesture ?? null;
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);
  const [isOnRight, setIsOnRight] = useState(true);

  // Reusable React Refs for dynamic JS callbacks to avoid worklet re-creation crashes
  const onDismissRef = useRef(onDismiss);
  const onPressRef = useRef(onPress);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    onPressRef.current = onPress;
  }, [onDismiss, onPress]);

  // Stable JS thread handlers to safely read the Refs
  const handleDismissJS = () => {
    if (onDismissRef.current) {
      onDismissRef.current();
    }
  };

  const handlePressJS = () => {
    if (onPressRef.current) {
      onPressRef.current();
    }
  };

  // Translation values relative to starting styled location
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Pulse animation scale
  const scale = useSharedValue(1);

  // Reanimated boolean latch for haptic boundary transitions
  const hapticTriggered = useSharedValue(false);

  // Track coordinates when the gesture begins
  const contextX = useSharedValue(0);
  const contextY = useSharedValue(0);

  // Track viewport dimensions dynamically
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const windowWidthSV = useSharedValue(windowWidth);
  const windowHeightSV = useSharedValue(windowHeight);
  const bottomOffsetSV = useSharedValue(bottomOffset);
  const previousLayoutRef = useRef({ bottomOffset, windowHeight, windowWidth });

  useEffect(() => {
    const previousLayout = previousLayoutRef.current;

    windowWidthSV.set(windowWidth);
    windowHeightSV.set(windowHeight);
    bottomOffsetSV.set(bottomOffset);

    const hasLayoutChanged =
      previousLayout.windowWidth !== windowWidth ||
      previousLayout.windowHeight !== windowHeight ||
      previousLayout.bottomOffset !== bottomOffset;

    if (hasLayoutChanged && !isDragging) {
      const anchoredTranslationX = getAnchoredFabTranslationX(
        windowWidth,
        isOnRight
      );
      const clampedTranslationY = getClampedFabTranslationY(
        windowHeight,
        bottomOffset,
        translateY.get()
      );
      translateX.set(
        withSpring(anchoredTranslationX, { damping: 15, stiffness: 120 })
      );
      translateY.set(
        withSpring(clampedTranslationY, { damping: 15, stiffness: 120 })
      );
    }

    previousLayoutRef.current = { bottomOffset, windowHeight, windowWidth };
  }, [
    bottomOffset,
    bottomOffsetSV,
    isDragging,
    isOnRight,
    translateX,
    translateY,
    windowHeight,
    windowHeightSV,
    windowWidth,
    windowWidthSV,
  ]);

  // Pulse animation loop
  useEffect(() => {
    if (isDragging) {
      cancelAnimation(scale);
      scale.set(withTiming(1.1, { duration: 150 }));
      return;
    }

    cancelAnimation(scale);
    scale.set(
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      )
    );

    return () => {
      cancelAnimation(scale);
    };
  }, [isDragging, scale]);

  const panGesture = Gesture
    ? Gesture.Pan()
        .minDistance(8)
        .onStart(() => {
          cancelAnimation(translateX);
          cancelAnimation(translateY);
          contextX.set(translateX.get());
          contextY.set(translateY.get());

          runOnJS(setIsDragging)(true);
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
        })
        .onUpdate((event) => {
          translateX.set(contextX.get() + event.translationX);
          translateY.set(contextY.get() + event.translationY);

          // Absolute coordinates calculation using shared values
          const currentWidth = windowWidthSV.get();
          const currentHeight = windowHeightSV.get();
          const currentBottomOffset = bottomOffsetSV.get();

          const startX = currentWidth - FAB_SIZE - EDGE_MARGIN;
          const startY = currentHeight - currentBottomOffset - FAB_SIZE;

          const absoluteX = startX + translateX.get();
          const absoluteY = startY + translateY.get();

          const fabCenterX = absoluteX + FAB_SIZE / 2;
          const fabCenterY = absoluteY + FAB_SIZE / 2;
          const dismissCenterX = currentWidth / 2;
          const dismissCenterY = currentHeight - 100;

          const dx = fabCenterX - dismissCenterX;
          const dy = fabCenterY - dismissCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const isOver = distance < 80;

          // Haptic boundary latch logic
          if (isOver && !hapticTriggered.get()) {
            hapticTriggered.set(true);
            runOnJS(setIsOverDismissZone)(true);
            runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
          } else if (!isOver && hapticTriggered.get()) {
            hapticTriggered.set(false);
            runOnJS(setIsOverDismissZone)(false);
          }
        })
        .onEnd((event) => {
          runOnJS(setIsDragging)(false);

          const currentWidth = windowWidthSV.get();
          const currentHeight = windowHeightSV.get();
          const currentBottomOffset = bottomOffsetSV.get();

          const startX = currentWidth - FAB_SIZE - EDGE_MARGIN;
          const startY = currentHeight - currentBottomOffset - FAB_SIZE;

          const absoluteX = startX + translateX.get();
          const absoluteY = startY + translateY.get();

          const isOverDismiss = hapticTriggered.get();
          hapticTriggered.set(false);
          runOnJS(setIsOverDismissZone)(false);

          if (isOverDismiss) {
            translateX.set(withSpring(0, { damping: 15, stiffness: 120 }));
            translateY.set(withSpring(0, { damping: 15, stiffness: 120 }));
            runOnJS(setIsOnRight)(true);
            runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
            runOnJS(handleDismissJS)();
            return;
          }

          // Snap to nearest horizontal edge
          const leftBound = EDGE_MARGIN;
          const rightBound = startX;

          const snapX = absoluteX + event.velocityX * 0.08;
          const targetXAbsolute =
            snapX + FAB_SIZE / 2 < currentWidth / 2 ? leftBound : rightBound;

          // Clamp vertical bounds
          const minY = 100;
          const maxY = currentHeight - currentBottomOffset - FAB_SIZE;
          let targetYAbsolute = absoluteY + event.velocityY * 0.04;
          targetYAbsolute = Math.max(minY, Math.min(targetYAbsolute, maxY));

          const targetTranslationX = targetXAbsolute - startX;
          const targetTranslationY = targetYAbsolute - startY;

          const isRight = targetXAbsolute === rightBound;
          runOnJS(setIsOnRight)(isRight);
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);

          translateX.set(
            withSpring(targetTranslationX, { damping: 15, stiffness: 120 })
          );
          translateY.set(
            withSpring(targetTranslationY, { damping: 15, stiffness: 120 })
          );
        })
        .onFinalize((_event, success) => {
          if (!success) {
            hapticTriggered.set(false);
            runOnJS(setIsDragging)(false);
            runOnJS(setIsOverDismissZone)(false);
          }
        })
    : null;

  const tapGesture = Gesture
    ? Gesture.Tap()
        .maxDistance(8)
        .onEnd(() => {
          runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
          runOnJS(handlePressJS)();
        })
    : null;

  const composedGesture =
    Gesture && panGesture && tapGesture
      ? Gesture.Simultaneous(panGesture, tapGesture)
      : null;

  return {
    composedGesture,
    translateX,
    translateY,
    scale,
    isDragging,
    isOverDismissZone,
    isOnRight,
  };
}
