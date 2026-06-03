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
import { usePanGesture, useTapGesture } from 'react-native-gesture-handler';
import {
  DISMISS_BOTTOM_OFFSET,
  DISMISS_RADIUS,
  EDGE_MARGIN,
  FAB_SIZE,
  GESTURE_MAX_TAP_DISTANCE,
  GESTURE_MIN_DISTANCE,
  TOP_CLAMP,
  VELOCITY_PROJECTOR_X,
  VELOCITY_PROJECTOR_Y,
} from './constants';
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

const noop = () => undefined;

export function useDraggableFab(
  bottomOffset: number,
  onDismiss?: () => void,
  onPress?: () => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);
  const [isOnRight, setIsOnRight] = useState(true);
  const handleDismissJS = onDismiss ?? noop;
  const handlePressJS = onPress ?? noop;

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

    windowWidthSV.value = windowWidth;
    windowHeightSV.value = windowHeight;
    bottomOffsetSV.value = bottomOffset;

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
        previousLayout.windowHeight - previousLayout.bottomOffset - FAB_SIZE,
        windowHeight,
        bottomOffset,
        translateY.value
      );
      translateX.value =
        withSpring(anchoredTranslationX, {
          damping: 15,
          stiffness: 120,
        });
      translateY.value =
        withSpring(clampedTranslationY, {
          damping: 15,
          stiffness: 120,
        });
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
      scale.value = withTiming(1.1, { duration: 150 });
      return;
    }

    cancelAnimation(scale);
    scale.value =
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );

    return () => {
      cancelAnimation(scale);
    };
  }, [isDragging, scale]);

  // 1. RNGH v3 Hook-Based Tap Definition
  const tapGesture = useTapGesture({
    maxDistance: GESTURE_MAX_TAP_DISTANCE,
    numberOfTaps: 1,
    onBegin: () => {
      'worklet';
      console.log('[FAB TAP] begin');
    },
    onActivate: () => {
      'worklet';
      console.log('[FAB TAP] activate');
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
      runOnJS(handlePressJS)();
    },
    onFinalize: () => {
      'worklet';
      console.log('[FAB TAP] finalize');
    },
  });

  // 2. RNGH v3 Hook-Based Pan Definition
  const panGesture = usePanGesture({
    minDistance: GESTURE_MIN_DISTANCE,
    simultaneousWith: tapGesture, // Declarative RNGH v3 relation
    onActivate: () => {
      'worklet';
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      contextX.value = translateX.value;
      contextY.value = translateY.value;

      runOnJS(setIsDragging)(true);
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
    },
    onUpdate: (event) => {
      'worklet';
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;

      // Absolute coordinates calculation using shared values
      const currentWidth = windowWidthSV.value;
      const currentHeight = windowHeightSV.value;
      const currentBottomOffset = bottomOffsetSV.value;

      const startX = currentWidth - FAB_SIZE - EDGE_MARGIN;
      const startY = currentHeight - currentBottomOffset - FAB_SIZE;

      const absoluteX = startX + translateX.value;
      const absoluteY = startY + translateY.value;

      const fabCenterX = absoluteX + FAB_SIZE / 2;
      const fabCenterY = absoluteY + FAB_SIZE / 2;
      const dismissCenterX = currentWidth / 2;
      const dismissCenterY = currentHeight - DISMISS_BOTTOM_OFFSET;

      const dx = fabCenterX - dismissCenterX;
      const dy = fabCenterY - dismissCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isOver = distance < DISMISS_RADIUS;

      // Haptic boundary latch logic
      if (isOver && !hapticTriggered.value) {
        hapticTriggered.value = true;
        runOnJS(setIsOverDismissZone)(true);
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Light);
      } else if (!isOver && hapticTriggered.value) {
        hapticTriggered.value = false;
        runOnJS(setIsOverDismissZone)(false);
      }
    },
    onDeactivate: (event) => {
      'worklet';
      runOnJS(setIsDragging)(false);

      const currentWidth = windowWidthSV.value;
      const currentHeight = windowHeightSV.value;
      const currentBottomOffset = bottomOffsetSV.value;

      const startX = currentWidth - FAB_SIZE - EDGE_MARGIN;
      const startY = currentHeight - currentBottomOffset - FAB_SIZE;

      const absoluteX = startX + translateX.value;
      const absoluteY = startY + translateY.value;

      const isOverDismiss = hapticTriggered.value;
      hapticTriggered.value = false;
      runOnJS(setIsOverDismissZone)(false);

      if (isOverDismiss) {
        translateX.value = withSpring(0, { damping: 15, stiffness: 120 });
        translateY.value = withSpring(0, { damping: 15, stiffness: 120 });
        runOnJS(setIsOnRight)(true);
        runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(handleDismissJS)();
        return;
      }

      // Snap to nearest horizontal edge
      const leftBound = EDGE_MARGIN;
      const rightBound = startX;

      const snapX = absoluteX + event.velocityX * VELOCITY_PROJECTOR_X;
      const targetXAbsolute =
        snapX + FAB_SIZE / 2 < currentWidth / 2 ? leftBound : rightBound;

      // Clamp vertical bounds
      const minY = TOP_CLAMP;
      const maxY = currentHeight - currentBottomOffset - FAB_SIZE;
      let targetYAbsolute =
        absoluteY + event.velocityY * VELOCITY_PROJECTOR_Y;
      targetYAbsolute = Math.max(minY, Math.min(targetYAbsolute, maxY));

      const targetTranslationX = targetXAbsolute - startX;
      const targetTranslationY = targetYAbsolute - startY;

      const isRight = targetXAbsolute === rightBound;
      runOnJS(setIsOnRight)(isRight);
      runOnJS(triggerHaptic)(Haptics.ImpactFeedbackStyle.Medium);

      translateX.value = withSpring(targetTranslationX, { damping: 15, stiffness: 120 });
      translateY.value = withSpring(targetTranslationY, { damping: 15, stiffness: 120 });
    },
    onFinalize: () => {
      'worklet';
      hapticTriggered.value = false;
      runOnJS(setIsDragging)(false);
      runOnJS(setIsOverDismissZone)(false);
    },
  });

  return {
    panGesture,
    tapGesture,
    translateX,
    translateY,
    scale,
    isDragging,
    isOverDismissZone,
    isOnRight,
  };
}
