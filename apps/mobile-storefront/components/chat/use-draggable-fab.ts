import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useWindowDimensions, Platform } from 'react-native';
import {
  usePanGesture,
  useTapGesture,
  useSimultaneousGestures,
} from 'react-native-gesture-handler';
import {
  useSharedValue,
  withSpring,
  cancelAnimation,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  EDGE_MARGIN,
  FAB_SIZE,
  GESTURE_MIN_DISTANCE,
  GESTURE_MAX_TAP_DISTANCE,
  DISMISS_RADIUS,
  DISMISS_BOTTOM_OFFSET,
  TOP_CLAMP,
  VELOCITY_PROJECTOR_X,
  VELOCITY_PROJECTOR_Y,
} from './constants';

// Define completely static, immutable haptic trigger outside the hook
const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
  if (Platform.OS === 'ios') {
    Haptics.impactAsync(style).catch(() => {});
  }
};

export function useDraggableFab(
  bottomOffset: number,
  onDismiss?: () => void,
  onPress?: () => void
) {
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

  useEffect(() => {
    windowWidthSV.value = windowWidth;
    windowHeightSV.value = windowHeight;
  }, [windowWidth, windowHeight, windowWidthSV, windowHeightSV]);

  // Track bottom offset dynamically
  const bottomOffsetSV = useSharedValue(bottomOffset);
  useEffect(() => {
    bottomOffsetSV.value = bottomOffset;
  }, [bottomOffset, bottomOffsetSV]);

  // Pulse animation loop
  useEffect(() => {
    if (isDragging) {
      cancelAnimation(scale);
      scale.value = withTiming(1.1, { duration: 150 });
      return;
    }

    cancelAnimation(scale);
    scale.value = withRepeat(
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

  // RNGH 3.0 Pan Gesture Definition
  const panGesture = usePanGesture({
    minDistance: GESTURE_MIN_DISTANCE,
    onActivate: () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      contextX.value = translateX.value;
      contextY.value = translateY.value;

      scheduleOnRN(setIsDragging, true);
      scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Light);
    },
    onUpdate: (event) => {
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
        scheduleOnRN(setIsOverDismissZone, true);
        scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Light);
      } else if (!isOver && hapticTriggered.value) {
        hapticTriggered.value = false;
        scheduleOnRN(setIsOverDismissZone, false);
      }
    },
    onDeactivate: (event) => {
      scheduleOnRN(setIsDragging, false);

      const currentWidth = windowWidthSV.value;
      const currentHeight = windowHeightSV.value;
      const currentBottomOffset = bottomOffsetSV.value;

      const startX = currentWidth - FAB_SIZE - EDGE_MARGIN;
      const startY = currentHeight - currentBottomOffset - FAB_SIZE;

      const absoluteX = startX + translateX.value;
      const absoluteY = startY + translateY.value;

      const isOverDismiss = hapticTriggered.value;
      hapticTriggered.value = false;
      scheduleOnRN(setIsOverDismissZone, false);

      if (isOverDismiss) {
        scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Medium);
        scheduleOnRN(handleDismissJS);
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
      let targetYAbsolute = absoluteY + event.velocityY * VELOCITY_PROJECTOR_Y;
      targetYAbsolute = Math.max(minY, Math.min(targetYAbsolute, maxY));

      const targetTranslationX = targetXAbsolute - startX;
      const targetTranslationY = targetYAbsolute - startY;

      const isRight = targetXAbsolute === rightBound;
      scheduleOnRN(setIsOnRight, isRight);
      scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Medium);

      translateX.value = withSpring(targetTranslationX, {
        damping: 15,
        stiffness: 120,
      });
      translateY.value = withSpring(targetTranslationY, {
        damping: 15,
        stiffness: 120,
      });
    },
  });

  // RNGH 3.0 Tap Gesture Definition
  const tapGesture = useTapGesture({
    maxDistance: GESTURE_MAX_TAP_DISTANCE,
    onActivate: () => {
      scheduleOnRN(triggerHaptic, Haptics.ImpactFeedbackStyle.Medium);
      scheduleOnRN(handlePressJS);
    },
  });

  // Compose simultaneous tap & pan gestures cleanly
  const composedGesture = useSimultaneousGestures(panGesture, tapGesture);

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
