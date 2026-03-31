import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import {
  NUDGE_HIDDEN_DURATION,
  NUDGE_INITIAL_DELAY,
  NUDGE_VISIBLE_DURATION,
} from './constants';
import { PROACTIVE_MESSAGES } from './types';

export function useProactiveNudge(isChatOpen: boolean) {
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const nudgeFadeAnim = useRef(new Animated.Value(0)).current;
  const _nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check reduced motion preference
  useEffect(() => {
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion
    );
    AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    return () => subscription.remove();
  }, []);

  // H25 fix: Proactive nudge logic with proper mounted guard to prevent timer leaks.
  // Use a local `active` flag that the cleanup sets to false, ensuring no new
  // timeouts are scheduled after the effect is torn down.
  useEffect(() => {
    if (reducedMotion) return;
    let active = true;

    const startVisibleCycle = () => {
      if (!active || isChatOpen) return;

      const randomMsg =
        PROACTIVE_MESSAGES[
          Math.floor(Math.random() * PROACTIVE_MESSAGES.length)
        ];
      setProactiveMsg(randomMsg);

      Animated.timing(nudgeFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      _nudgeTimerRef.current = setTimeout(
        startHiddenCycle,
        NUDGE_VISIBLE_DURATION
      );
    };

    const startHiddenCycle = () => {
      if (!active) return;
      Animated.timing(nudgeFadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        if (!active) return;
        setProactiveMsg(null);
        if (!isChatOpen) {
          _nudgeTimerRef.current = setTimeout(
            startVisibleCycle,
            NUDGE_HIDDEN_DURATION
          );
        }
      });
    };

    _nudgeTimerRef.current = setTimeout(startVisibleCycle, NUDGE_INITIAL_DELAY);

    return () => {
      active = false;
      if (_nudgeTimerRef.current) clearTimeout(_nudgeTimerRef.current);
    };
  }, [isChatOpen, nudgeFadeAnim, reducedMotion]);

  // Immediately hide proactive message when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setProactiveMsg(null);
      nudgeFadeAnim.setValue(0);
    }
  }, [isChatOpen, nudgeFadeAnim]);

  const dismissNudge = () => {
    Animated.timing(nudgeFadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setProactiveMsg(null));
  };

  return { proactiveMsg, nudgeFadeAnim, dismissNudge };
}
