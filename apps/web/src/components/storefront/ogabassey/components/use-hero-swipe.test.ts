import { renderHook } from '@testing-library/react';
import type { MouseEvent, TouchEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHeroSwipe } from './use-hero-swipe';

function touchEventAt(clientX: number): TouchEvent {
  return {
    touches: [{ clientX }],
    changedTouches: [{ clientX }],
  } as unknown as TouchEvent;
}

function createClickEvent() {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  return {
    event: { preventDefault, stopPropagation } as unknown as MouseEvent,
    preventDefault,
    stopPropagation,
  };
}

function renderSwipeHook(hasMultipleSlides = true) {
  const onPausedChange = vi.fn();
  const onRearm = vi.fn();
  const onSwipe = vi.fn();
  const { result } = renderHook(() =>
    useHeroSwipe({ hasMultipleSlides, onPausedChange, onRearm, onSwipe })
  );
  return { result, onPausedChange, onRearm, onSwipe };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useHeroSwipe', () => {
  it('advances forward when the touch travels left past the threshold', () => {
    const { result, onSwipe, onRearm } = renderSwipeHook();

    result.current.handleTouchStart(touchEventAt(220));
    result.current.handleTouchEnd(touchEventAt(60));

    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(1);
    expect(onRearm).not.toHaveBeenCalled();
  });

  it('advances backward when the touch travels right past the threshold', () => {
    const { result, onSwipe } = renderSwipeHook();

    result.current.handleTouchStart(touchEventAt(60));
    result.current.handleTouchEnd(touchEventAt(220));

    expect(onSwipe).toHaveBeenCalledOnce();
    expect(onSwipe).toHaveBeenCalledWith(-1);
  });

  it('re-arms the countdown instead of swiping for a sub-threshold tap', () => {
    const { result, onSwipe, onRearm } = renderSwipeHook();

    result.current.handleTouchStart(touchEventAt(100));
    result.current.handleTouchEnd(touchEventAt(110));

    expect(onSwipe).not.toHaveBeenCalled();
    expect(onRearm).toHaveBeenCalledOnce();
  });

  it('pauses autoplay for the duration of the touch', () => {
    const { result, onPausedChange } = renderSwipeHook();

    result.current.handleTouchStart(touchEventAt(100));
    expect(onPausedChange).toHaveBeenLastCalledWith(true);

    result.current.handleTouchEnd(touchEventAt(100));
    expect(onPausedChange).toHaveBeenLastCalledWith(false);
  });

  it('suppresses only the click that follows a completed swipe', () => {
    const { result } = renderSwipeHook();
    result.current.handleTouchStart(touchEventAt(220));
    result.current.handleTouchEnd(touchEventAt(60));

    const swipeClick = createClickEvent();
    result.current.handleClickCapture(swipeClick.event);
    const followUpClick = createClickEvent();
    result.current.handleClickCapture(followUpClick.event);

    expect(swipeClick.preventDefault).toHaveBeenCalledOnce();
    expect(swipeClick.stopPropagation).toHaveBeenCalledOnce();
    expect(followUpClick.preventDefault).not.toHaveBeenCalled();
  });

  it('stops suppressing clicks after the safety-net timeout', () => {
    vi.useFakeTimers();
    const { result } = renderSwipeHook();
    result.current.handleTouchStart(touchEventAt(220));
    result.current.handleTouchEnd(touchEventAt(60));

    vi.advanceTimersByTime(400);
    const click = createClickEvent();
    result.current.handleClickCapture(click.event);

    expect(click.preventDefault).not.toHaveBeenCalled();
    expect(click.stopPropagation).not.toHaveBeenCalled();
  });

  it('clears the transient pause and re-arms on touch cancel', () => {
    const { result, onPausedChange, onRearm, onSwipe } = renderSwipeHook();
    result.current.handleTouchStart(touchEventAt(220));

    result.current.handleTouchCancel();
    result.current.handleTouchEnd(touchEventAt(60));

    expect(onPausedChange).toHaveBeenLastCalledWith(false);
    expect(onRearm).toHaveBeenCalledOnce();
    // The cancelled gesture cleared the start point, so no swipe fires.
    expect(onSwipe).not.toHaveBeenCalled();
  });

  it('ignores swipe gestures when there is only one slide', () => {
    const { result, onSwipe, onRearm, onPausedChange } =
      renderSwipeHook(false);

    result.current.handleTouchStart(touchEventAt(220));
    result.current.handleTouchEnd(touchEventAt(60));

    expect(onSwipe).not.toHaveBeenCalled();
    expect(onRearm).not.toHaveBeenCalled();
    expect(onPausedChange).toHaveBeenLastCalledWith(false);
  });
});
