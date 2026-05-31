import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Platform } from 'react-native';
import { EDGE_MARGIN, FAB_SIZE } from './constants';

export function useDraggableFab(
  bottomOffset: number,
  onDismiss?: () => void,
  onPress?: () => void
) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);
  const isOverDismissZoneRef = useRef(false);


  

  // Draggable FAB translation - starts at (0, 0) relative to its styled layout position
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Track if user moved significantly (to distinguish tap from drag)
  const hasMoved = useRef(false);

  // Pulse animation for FAB (only when not dragging)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Track accumulated translation values via listeners
  const panXRef = useRef(0);
  const panYRef = useRef(0);

  useEffect(() => {
    const xId = pan.x.addListener(({ value }) => {
      panXRef.current = value;
    });
    const yId = pan.y.addListener(({ value }) => {
      panYRef.current = value;
    });
    return () => {
      pan.x.removeListener(xId);
      pan.y.removeListener(yId);
    };
  }, [pan.x, pan.y]);

  // Store coordinates at the start of gesture (grant time)
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);

  // M30 fix: Use ref for bottomOffset so PanResponder always reads fresh value
  const bottomOffsetRef = useRef(bottomOffset);
  bottomOffsetRef.current = bottomOffset;

  // Pan responder for drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        hasMoved.current = false;
        setIsDragging(true);
        setIsOverDismissZone(false);
        isOverDismissZoneRef.current = false;

        // Record starting absolute translation before resetting value to 0
        dragStartXRef.current = panXRef.current;
        dragStartYRef.current = panYRef.current;

        // Record translation offset and reset value to 0 for delta tracking
        pan.setOffset({
          x: panXRef.current,
          y: panYRef.current,
        });
        pan.setValue({ x: 0, y: 0 });

        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          hasMoved.current = true;
        }

        // Set value directly relative to offset
        pan.setValue({ x: gestureState.dx, y: gestureState.dy });

        // Calculate absolute position based on start layout + accumulated translation offset + current gesture delta
        const { width: screenW, height: screenH } = Dimensions.get('window');
        const currentStartX = screenW - FAB_SIZE - EDGE_MARGIN;
        const currentStartY = screenH - bottomOffsetRef.current - FAB_SIZE;

        const absoluteX = currentStartX + dragStartXRef.current + gestureState.dx;
        const absoluteY = currentStartY + dragStartYRef.current + gestureState.dy;

        // Realtime distance detection to the bottom center Dismiss Zone
        const fabCenterX = absoluteX + FAB_SIZE / 2;
        const fabCenterY = absoluteY + FAB_SIZE / 2;
        
        // Center of screen bottom (where dismiss zone resides)
        const dismissCenterX = screenW / 2;
        const dismissCenterY = screenH - 100;

        const dx = fabCenterX - dismissCenterX;
        const dy = fabCenterY - dismissCenterY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Hover threshold: 80px
        const isHovering = distance < 80;

        if (isHovering) {
          if (!isOverDismissZoneRef.current) {
            isOverDismissZoneRef.current = true;
            setIsOverDismissZone(true);
            if (Platform.OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
          }
        } else {
          if (isOverDismissZoneRef.current) {
            isOverDismissZoneRef.current = false;
            setIsOverDismissZone(false);
          }
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);

        // If user tapped without dragging, trigger the onPress callback
        if (!hasMoved.current) {
          pan.flattenOffset();
          setIsOverDismissZone(false);
          isOverDismissZoneRef.current = false;
          if (onPress) {
            onPress();
          }
          return;
        }

        // Check if released over Dismiss Zone
        if (isOverDismissZoneRef.current) {
          pan.flattenOffset();
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          setIsOverDismissZone(false);
          isOverDismissZoneRef.current = false;
          if (onDismiss) {
            onDismiss();
          }
          return;
        }

        // Save translation state by flattening the offset
        pan.flattenOffset();

        const currentTranslationX = panXRef.current;
        const currentTranslationY = panYRef.current;
        const { width: screenW, height: screenH } = Dimensions.get('window');

        // Current start layout coordinates
        const currentStartX = screenW - FAB_SIZE - EDGE_MARGIN;
        const currentStartY = screenH - bottomOffsetRef.current - FAB_SIZE;

        // Current absolute coordinates
        const currentX = currentStartX + currentTranslationX;
        const currentY = currentStartY + currentTranslationY;

        // Snaps to edges: left or right nearest horizontal bound
        const leftBound = EDGE_MARGIN;
        const rightBound = screenW - FAB_SIZE - EDGE_MARGIN;
        const targetX = currentX + FAB_SIZE / 2 < screenW / 2 ? leftBound : rightBound;

        // Clamp Y inside vertical margins
        const clampBottom = bottomOffsetRef.current;
        const minY = 100; // Below status bar
        const maxY = screenH - clampBottom - FAB_SIZE;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        // Convert the target absolute coordinates back to translation values
        const targetTranslationX = targetX - currentStartX;
        const targetTranslationY = targetY - currentStartY;

        // Animate translation to snapped position
        Animated.spring(pan, {
          toValue: { x: targetTranslationX, y: targetTranslationY },
          useNativeDriver: false,
          friction: 7,
          tension: 40,
        }).start();

        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      },
    })
  ).current;

  // Track which side the FAB is on (for nudge positioning)
  const isOnRight = useRef(true);

  useEffect(() => {
    const listenerId = pan.x.addListener(({ value }) => {
      const currentWidth = Dimensions.get('window').width;
      const currentStartX = currentWidth - FAB_SIZE - EDGE_MARGIN;
      const absoluteX = currentStartX + value;
      isOnRight.current = absoluteX + FAB_SIZE / 2 > currentWidth / 2;
    });
    return () => {
      pan.x.removeListener(listenerId);
    };
  }, [pan.x]);

  // Pulse animation loop (only when not dragging)
  useEffect(() => {
    if (isDragging) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim, isDragging]);

  return {
    pan,
    panResponder,
    pulseAnim,
    isDragging,
    isOverDismissZone,
    hasMoved,
    isOnRight,
  };
}
