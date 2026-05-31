import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Dimensions, Platform } from 'react-native';
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
import { EDGE_MARGIN, FAB_SIZE } from './constants';

export function useDraggableFab(
  bottomOffset: number,
  onDismiss?: () => void,
  onPress?: () => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);
  const [isOnRight, setIsOnRight] = useState(true);

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

  // Window dimension tracking
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

  // Trigger haptic feedback safely
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(style).catch(() => {});
    }
  };

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
    minDistance: 8,
    onActivate: () => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      contextX.value = translateX.value;
      contextY.value = translateY.value;

      scheduleOnRN(() => {
        setIsDragging(true);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      });
    },
    onUpdate: (event) => {
      translateX.value = contextX.value + event.translationX;
      translateY.value = contextY.value + event.translationY;

      // Absolute coordinates calculation
      const startX = windowWidth - FAB_SIZE - EDGE_MARGIN;
      const startY = windowHeight - bottomOffset - FAB_SIZE;

      const absoluteX = startX + translateX.value;
      const absoluteY = startY + translateY.value;

      const fabCenterX = absoluteX + FAB_SIZE / 2;
      const fabCenterY = absoluteY + FAB_SIZE / 2;
      const dismissCenterX = windowWidth / 2;
      const dismissCenterY = windowHeight - 100;

      const dx = fabCenterX - dismissCenterX;
      const dy = fabCenterY - dismissCenterY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isOver = distance < 80;

      // Haptic boundary latch logic
      if (isOver && !hapticTriggered.value) {
        hapticTriggered.value = true;
        scheduleOnRN(() => {
          setIsOverDismissZone(true);
          triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        });
      } else if (!isOver && hapticTriggered.value) {
        hapticTriggered.value = false;
        scheduleOnRN(() => {
          setIsOverDismissZone(false);
        });
      }
    },
    onDeactivate: (event) => {
      scheduleOnRN(() => {
        setIsDragging(false);
      });

      const startX = windowWidth - FAB_SIZE - EDGE_MARGIN;
      const startY = windowHeight - bottomOffset - FAB_SIZE;

      const absoluteX = startX + translateX.value;
      const absoluteY = startY + translateY.value;

      const isOverDismiss = hapticTriggered.value;
      hapticTriggered.value = false;
      scheduleOnRN(() => {
        setIsOverDismissZone(false);
      });

      if (isOverDismiss) {
        scheduleOnRN(() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          if (onDismiss) {
            onDismiss();
          }
        });
        return;
      }

      // Snap to nearest horizontal edge
      const leftBound = EDGE_MARGIN;
      const rightBound = startX;

      const snapX = absoluteX + event.velocityX * 0.08;
      const targetXAbsolute = snapX + FAB_SIZE / 2 < windowWidth / 2 ? leftBound : rightBound;

      // Clamp vertical bounds
      const clampBottom = bottomOffset;
      const minY = 100;
      const maxY = windowHeight - clampBottom - FAB_SIZE;
      let targetYAbsolute = absoluteY + event.velocityY * 0.04;
      targetYAbsolute = Math.max(minY, Math.min(targetYAbsolute, maxY));

      const targetTranslationX = targetXAbsolute - startX;
      const targetTranslationY = targetYAbsolute - startY;

      const isRight = targetXAbsolute === rightBound;
      scheduleOnRN(() => {
        setIsOnRight(isRight);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      });

      translateX.value = withSpring(targetTranslationX, { damping: 15, stiffness: 120 });
      translateY.value = withSpring(targetTranslationY, { damping: 15, stiffness: 120 });
    },
  });

  // RNGH 3.0 Tap Gesture Definition
  const tapGesture = useTapGesture({
    maxDistance: 8,
    onDeactivate: (event) => {
      if (!event.canceled) {
        scheduleOnRN(() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          if (onPress) {
            onPress();
          }
        });
      }
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
