'use client';

import { useEffect, useRef, useState } from 'react';

interface CarouselProgressFillProps {
  animate: boolean;
  cycleKey: number;
  isPaused: boolean;
  /** Duration of the 0 → 100% fill, matched to the autoplay interval. */
  durationMs: number;
}

/**
 * Stories-style progress fill for the active slide: animates 0 → 100% over the
 * autoplay interval (compositor-only `scaleX` via the Web Animations API, so it
 * never fights React's inline style). Restarts whenever `cycleKey` changes (a
 * slide change or a resume) and pauses with autoplay. Static when `animate` is
 * false (reduced motion / single slide), and shown filled rather than stuck
 * empty when the Web Animations API is unavailable.
 */
export function CarouselProgressFill({
  animate,
  cycleKey,
  isPaused,
  durationMs,
}: CarouselProgressFillProps) {
  const fillRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  // When the Web Animations API is unavailable, render the bar filled via
  // derived state so it survives re-renders (a one-off DOM mutation would be
  // reset to scaleX(0) by the next render's inline style).
  const [waapiUnavailable, setWaapiUnavailable] = useState(false);

  useEffect(() => {
    const element = fillRef.current;
    if (!element || !animate) {
      return;
    }
    if (typeof element.animate !== 'function') {
      setWaapiUnavailable(true);
      return;
    }
    const animation = element.animate(
      [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
      { duration: durationMs, easing: 'linear', fill: 'forwards' }
    );
    animationRef.current = animation;
    return () => {
      animation.cancel();
      animationRef.current = null;
    };
  }, [animate, cycleKey, durationMs]);

  // Apply the current pause state. `cycleKey` is a dependency so that a freshly
  // created animation (after a restart) is paused too when the carousel is
  // paused, instead of auto-running on its own.
  useEffect(() => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }
    if (isPaused) {
      animation.pause();
    } else {
      animation.play();
    }
  }, [isPaused, cycleKey]);

  // Filled when there's no animation to run (reduced motion / single slide) or
  // when WAAPI is unavailable; otherwise start empty and let the animation fill.
  const isFilled = !animate || waapiUnavailable;

  return (
    <span
      className="block h-full w-full origin-left rounded-full bg-store-primary"
      ref={fillRef}
      style={{ transform: isFilled ? 'scaleX(1)' : 'scaleX(0)' }}
    />
  );
}
