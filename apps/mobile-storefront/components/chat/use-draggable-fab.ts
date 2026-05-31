import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, PanResponder, Platform } from 'react-native';
import { EDGE_MARGIN, FAB_SIZE } from './constants';

export function useDraggableFab(bottomOffset: number, onDismiss?: () => void) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOverDismissZone, setIsOverDismissZone] = useState(false);
  const isOverDismissZoneRef = useRef(false);

  // Use runtime dimensions for initial position (not stale module-level constants)
  const { width: initialW, height: initialH } = Dimensions.get('window');

  // Draggable FAB position - starts at bottom right
  const pan = useRef(
    new Animated.ValueXY({
      x: initialW - FAB_SIZE - EDGE_MARGIN,
      y: initialH - bottomOffset - FAB_SIZE,
    })
  ).current;

  // Track if user moved significantly (to distinguish tap from drag)
  const hasMoved = useRef(false);

  // Pulse animation for FAB (only when not dragging)
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // M29 fix: Track animated values via listeners instead of accessing private _value
  const panXRef = useRef(initialW - FAB_SIZE - EDGE_MARGIN);
  const panYRef = useRef(initialH - bottomOffset - FAB_SIZE);

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
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only capture if user moved more than 5px
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        hasMoved.current = false;
        setIsDragging(true);
        setIsOverDismissZone(false);
        isOverDismissZoneRef.current = false;

        // Record starting absolute coordinates of the FAB
        dragStartXRef.current = panXRef.current;
        dragStartYRef.current = panYRef.current;

        if (Platform.OS === 'ios') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (e, gestureState) => {
        if (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5) {
          hasMoved.current = true;
        }

        // Calculate absolute position based on starting coordinates + delta displacement
        const absoluteX = dragStartXRef.current + gestureState.dx;
        const absoluteY = dragStartYRef.current + gestureState.dy;

        // Set the values directly on the animated coordinate system for synchronous updates
        pan.setValue({ x: absoluteX, y: absoluteY });

        // Realtime distance detection to the bottom center Dismiss Zone
        const { width: screenW, height: screenH } = Dimensions.get('window');
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

        // Check if released over Dismiss Zone
        if (isOverDismissZoneRef.current) {
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

        const currentX = panXRef.current;
        const currentY = panYRef.current;
        const { width: screenW, height: screenH } = Dimensions.get('window');

        // Clamp FAB inside margins (doesn't hard snap to left/right, stays anywhere)
        const targetX = Math.min(
          Math.max(currentX, EDGE_MARGIN),
          screenW - FAB_SIZE - EDGE_MARGIN
        );

        // M30 fix: Read bottomOffset from ref for fresh value
        const clampBottom = bottomOffsetRef.current;
        const minY = 100; // Below status bar
        const maxY = screenH - clampBottom - FAB_SIZE;
        const targetY = Math.min(Math.max(currentY, minY), maxY);

        // Animate to snapped position
        Animated.spring(pan, {
          toValue: { x: targetX, y: targetY },
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
      // Use runtime Dimensions instead of stale module-level SNAP_THRESHOLD
      // so nudge position stays correct after orientation changes
      const currentWidth = Dimensions.get('window').width;
      isOnRight.current = value + FAB_SIZE / 2 > currentWidth / 2;
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
