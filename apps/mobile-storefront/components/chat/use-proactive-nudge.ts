import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  cancelAnimation,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import {
  NUDGE_HIDDEN_DURATION,
  NUDGE_INITIAL_DELAY,
  NUDGE_VISIBLE_DURATION,
} from './constants';
import { PROACTIVE_MESSAGES } from './types';

export function useProactiveNudge(isChatOpen: boolean) {
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  
  // Reanimated UI-thread Shared Value for continuous C++ fading
  const nudgeFadeAnim = useSharedValue(0);
  const nudgeFadeAnimRef = useRef(nudgeFadeAnim);

  // Check reduced motion preference with mounted guard
  useEffect(() => {
    let mounted = true;
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        if (mounted) setReducedMotion(value);
      }
    );
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Proactive nudge animation chains running entirely on the C++ UI-thread
  useEffect(() => {
    const fadeAnim = nudgeFadeAnimRef.current;

    if (reducedMotion || isChatOpen) {
      cancelAnimation(fadeAnim);
      fadeAnim.value = 0;
      setProactiveMsg(null);
      return;
    }
    
    let active = true;

    const runLoopCycle = () => {
      if (!active || isChatOpen) return;

      const randomMsg =
        PROACTIVE_MESSAGES[
          Math.floor(Math.random() * PROACTIVE_MESSAGES.length)
        ];
      
      // Update message on JS thread
      setProactiveMsg(randomMsg);

      // Drive sequential animations natively on C++ thread
      fadeAnim.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          NUDGE_VISIBLE_DURATION,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished && active) {
              runOnJS(setProactiveMsg)(null);
              // Wait for hidden duration and run next cycle
              fadeAnim.value = withDelay(
                NUDGE_HIDDEN_DURATION,
                withTiming(0, { duration: 0 }, () => {
                  if (active) {
                    runOnJS(runLoopCycle)();
                  }
                })
              );
            }
          })
        )
      );
    };

    // Stagger loop start with initial delay
    fadeAnim.value = withDelay(
      NUDGE_INITIAL_DELAY,
      withTiming(0, { duration: 0 }, () => {
        if (active) {
          runOnJS(runLoopCycle)();
        }
      })
    );

    return () => {
      active = false;
      cancelAnimation(fadeAnim);
      fadeAnim.value = 0;
    };
  }, [isChatOpen, reducedMotion]);

  // Immediately hide proactive message when chat opens
  useEffect(() => {
    const fadeAnim = nudgeFadeAnimRef.current;

    if (isChatOpen) {
      cancelAnimation(fadeAnim);
      setProactiveMsg(null);
      fadeAnim.value = 0;
    }
  }, [isChatOpen]);

  const dismissNudge = () => {
    const fadeAnim = nudgeFadeAnimRef.current;

    fadeAnim.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setProactiveMsg)(null);
      }
    });
  };

  return { proactiveMsg, nudgeFadeAnim, dismissNudge };
}
