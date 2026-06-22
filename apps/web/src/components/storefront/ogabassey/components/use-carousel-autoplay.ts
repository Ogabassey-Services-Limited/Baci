'use client';

import type React from 'react';
import { useState } from 'react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

interface CarouselAutoplay {
  /** Whether autoplay should advance right now (respects play state, hover, focus, reduced-motion). */
  isActive: boolean;
  /** The user's explicit play/pause intent. */
  isPlaying: boolean;
  /** True when the OS requests reduced motion — autoplay is suppressed and the play/pause control is unnecessary. */
  prefersReducedMotion: boolean;
  /** Toggle the explicit play/pause state. */
  toggle: () => void;
  /** Spread onto the carousel container to pause on hover and keyboard focus. */
  containerHandlers: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocus: () => void;
    onBlur: (event: React.FocusEvent) => void;
  };
}

/**
 * Autoplay state for an auto-rotating carousel that satisfies WCAG 2.2.2 (Pause,
 * Stop, Hide): motion stops on hover, on keyboard focus (hover and focus are
 * tracked separately so leaving with the pointer keeps it paused while focus is
 * inside), when the user toggles pause, and when the OS prefers reduced motion.
 */
export function useCarouselAutoplay(): CarouselAutoplay {
  const prefersReducedMotion = useReducedMotion();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);

  const isActive =
    isPlaying && !isHovered && !isFocusWithin && !prefersReducedMotion;

  return {
    isActive,
    isPlaying,
    prefersReducedMotion,
    toggle: () => setIsPlaying((playing) => !playing),
    containerHandlers: {
      onMouseEnter: () => setIsHovered(true),
      onMouseLeave: () => setIsHovered(false),
      onFocus: () => setIsFocusWithin(true),
      onBlur: (event) => {
        // Resume only when focus truly leaves the carousel (not when moving
        // between its own slides/dots/controls).
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsFocusWithin(false);
        }
      },
    },
  };
}
