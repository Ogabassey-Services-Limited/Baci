import { useEffect, useRef, type RefObject } from 'react';
import { InteractionManager, type ScrollView } from 'react-native';
import { SPACING } from '@/constants/Colors';

export function useNextStepScroll(
  scrollViewRef: RefObject<ScrollView | null>,
  onScrolled: () => void
) {
  const pendingScrollYRef = useRef<number | null>(null);
  const isScrollScheduledRef = useRef(false);
  const isMountedRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const interactionRef = useRef<{ cancel?: () => void } | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      interactionRef.current?.cancel?.();
      interactionRef.current = null;
      pendingScrollYRef.current = null;
      isScrollScheduledRef.current = false;
    };
  }, []);

  return (nextStepY: number) => {
    pendingScrollYRef.current = Math.max(nextStepY - SPACING.md, 0);
    if (isScrollScheduledRef.current) {
      return;
    }
    isScrollScheduledRef.current = true;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      interactionRef.current = InteractionManager.runAfterInteractions(() => {
        interactionRef.current = null;
        const scrollY = pendingScrollYRef.current;
        pendingScrollYRef.current = null;
        isScrollScheduledRef.current = false;
        if (!isMountedRef.current || scrollY === null) {
          return;
        }
        scrollViewRef.current?.scrollTo({ animated: true, y: scrollY });
        onScrolled();
      });
    });
  };
}
