import type { MouseEvent, TouchEvent } from 'react';
import { useEffect, useRef } from 'react';

const SWIPE_THRESHOLD_PX = 40;

interface UseHeroSwipeOptions {
  /** Swipes are ignored when there is only one slide (pause still clears). */
  hasMultipleSlides: boolean;
  /** Transient pause while a touch is in progress. */
  onPausedChange: (paused: boolean) => void;
  /** Re-arm the current slide's countdown + progress fill together. */
  onRearm: () => void;
  /** Advance one slide in the swiped direction (1 = next, -1 = previous). */
  onSwipe: (direction: -1 | 1) => void;
}

interface HeroSwipeHandlers {
  handleClickCapture: (event: MouseEvent) => void;
  handleTouchCancel: () => void;
  handleTouchEnd: (event: TouchEvent) => void;
  handleTouchStart: (event: TouchEvent) => void;
}

/**
 * Touch/swipe gesture handling for the mobile hero carousel: horizontal swipes
 * past the threshold change slides, a sub-threshold tap re-arms the autoplay
 * countdown, and a completed swipe suppresses the click that would otherwise
 * follow through to the slide's full-bleed PDP link.
 */
export function useHeroSwipe({
  hasMultipleSlides,
  onPausedChange,
  onRearm,
  onSwipe,
}: UseHeroSwipeOptions): HeroSwipeHandlers {
  const touchStartXRef = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  const swipeResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
      }
    };
  }, []);

  const handleTouchStart = (event: TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    swipeHandledRef.current = false;
    onPausedChange(true);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX !== null && hasMultipleSlides) {
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const deltaX = endX - startX;
      if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
        swipeHandledRef.current = true;
        onSwipe(deltaX < 0 ? 1 : -1);
        // Safety net: if the browser never emits the post-swipe click, clear the
        // suppression flag after a beat so the next genuine tap isn't blocked.
        if (swipeResetTimerRef.current !== null) {
          window.clearTimeout(swipeResetTimerRef.current);
        }
        swipeResetTimerRef.current = window.setTimeout(() => {
          swipeHandledRef.current = false;
          swipeResetTimerRef.current = null;
        }, 400);
      } else {
        // A tap/hold without a swipe just re-arms the current slide's timer.
        onRearm();
      }
    }
    onPausedChange(false);
  };

  // touchcancel (e.g. the browser hijacks the gesture for a vertical scroll)
  // fires instead of touchend — clear the same state so autoplay resumes.
  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    swipeHandledRef.current = false;
    if (swipeResetTimerRef.current !== null) {
      window.clearTimeout(swipeResetTimerRef.current);
      swipeResetTimerRef.current = null;
    }
    onPausedChange(false);
    // Re-arm the countdown + fill so they resume in sync after the cancel.
    onRearm();
  };

  // A completed swipe must not also trigger the slide's full-bleed PDP link.
  const handleClickCapture = (event: MouseEvent) => {
    if (swipeHandledRef.current) {
      event.preventDefault();
      event.stopPropagation();
      swipeHandledRef.current = false;
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
        swipeResetTimerRef.current = null;
      }
    }
  };

  return {
    handleClickCapture,
    handleTouchCancel,
    handleTouchEnd,
    handleTouchStart,
  };
}
