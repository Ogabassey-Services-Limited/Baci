import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
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
    if (reducedMotion || isChatOpen) {
      nudgeFadeAnim.value = 0;
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
      nudgeFadeAnim.value = withSequence(
        withTiming(1, { duration: 300 }),
        withDelay(
          NUDGE_VISIBLE_DURATION,
          withTiming(0, { duration: 300 }, (finished) => {
            if (finished && active) {
              runOnJS(setProactiveMsg)(null);
              // Wait for hidden duration and run next cycle
              nudgeFadeAnim.value = withDelay(
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
    nudgeFadeAnim.value = withDelay(
      NUDGE_INITIAL_DELAY,
      withTiming(0, { duration: 0 }, () => {
        if (active) {
          runOnJS(runLoopCycle)();
        }
      })
    );

    return () => {
      active = false;
      nudgeFadeAnim.value = 0;
    };
  }, [isChatOpen, nudgeFadeAnim, reducedMotion]);

  // Immediately hide proactive message when chat opens
  useEffect(() => {
    if (isChatOpen) {
      setProactiveMsg(null);
      nudgeFadeAnim.value = 0;
    }
  }, [isChatOpen, nudgeFadeAnim]);

  const dismissNudge = () => {
    nudgeFadeAnim.value = withTiming(0, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(setProactiveMsg)(null);
      }
    });
  };

  return { proactiveMsg, nudgeFadeAnim, dismissNudge };
}
