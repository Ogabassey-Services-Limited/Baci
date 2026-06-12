import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
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
  const loopGeneration = useSharedValue(0);

  // Hide the nudge message during render (no stale frame) whenever the chat
  // opens or reduced motion turns on.
  const shouldHideNudge = reducedMotion || isChatOpen;
  const [prevShouldHideNudge, setPrevShouldHideNudge] =
    useState(shouldHideNudge);
  if (shouldHideNudge !== prevShouldHideNudge) {
    setPrevShouldHideNudge(shouldHideNudge);
    if (shouldHideNudge) {
      setProactiveMsg(null);
    }
  }

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
    loopGeneration.set(loopGeneration.get() + 1);

    if (reducedMotion || isChatOpen) {
      cancelAnimation(nudgeFadeAnim);
      nudgeFadeAnim.set(0);
      return;
    }

    const loopId = loopGeneration.get();

    const runLoopCycle = () => {
      if (loopGeneration.get() !== loopId || isChatOpen) return;

      const randomMsg =
        PROACTIVE_MESSAGES[
          Math.floor(Math.random() * PROACTIVE_MESSAGES.length)
        ];

      // Update message on JS thread
      setProactiveMsg(randomMsg);

      // Drive sequential animations natively on C++ thread
      nudgeFadeAnim.set(
        withSequence(
          withTiming(1, { duration: 300 }),
          withDelay(
            NUDGE_VISIBLE_DURATION,
            withTiming(0, { duration: 300 }, (finished) => {
              if (finished && loopGeneration.get() === loopId) {
                runOnJS(setProactiveMsg)(null);
                // Wait for hidden duration and run next cycle
                nudgeFadeAnim.set(
                  withDelay(
                    NUDGE_HIDDEN_DURATION,
                    withTiming(0, { duration: 0 }, () => {
                      if (loopGeneration.get() === loopId) {
                        runOnJS(runLoopCycle)();
                      }
                    })
                  )
                );
              }
            })
          )
        )
      );
    };

    // Stagger loop start with initial delay
    nudgeFadeAnim.set(
      withDelay(
        NUDGE_INITIAL_DELAY,
        withTiming(0, { duration: 0 }, () => {
          if (loopGeneration.get() === loopId) {
            runOnJS(runLoopCycle)();
          }
        })
      )
    );

    return () => {
      loopGeneration.set(loopGeneration.get() + 1);
      cancelAnimation(nudgeFadeAnim);
      nudgeFadeAnim.set(0);
    };
  }, [isChatOpen, loopGeneration, nudgeFadeAnim, reducedMotion]);

  // Immediately stop the fade animation when chat opens
  useEffect(() => {
    if (isChatOpen) {
      cancelAnimation(nudgeFadeAnim);
      nudgeFadeAnim.set(0);
    }
  }, [isChatOpen, nudgeFadeAnim]);

  const dismissNudge = () => {
    nudgeFadeAnim.set(
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(setProactiveMsg)(null);
        }
      })
    );
  };

  return { proactiveMsg, nudgeFadeAnim, dismissNudge };
}
