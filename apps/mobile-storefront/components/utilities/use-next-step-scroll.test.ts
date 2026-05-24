import { jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import type { RefObject } from 'react';
import { InteractionManager, type ScrollView } from 'react-native';
import { SPACING } from '@/constants/Colors';
import { useNextStepScroll } from './use-next-step-scroll';

type InteractionHandle = {
  cancel: jest.Mock;
  run: () => void;
};

const mockRunAfterInteractions =
  jest.fn<(callback: () => void) => InteractionHandle>();

type FrameCallback = Parameters<typeof requestAnimationFrame>[0];

describe('useNextStepScroll', () => {
  let frameCallbacks: Map<number, FrameCallback>;
  let nextFrameId: number;

  beforeEach(() => {
    jest.clearAllMocks();
    frameCallbacks = new Map();
    nextFrameId = 1;
    jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((callback: FrameCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        frameCallbacks.set(frameId, callback);
        return frameId;
      });
    jest.spyOn(global, 'cancelAnimationFrame').mockImplementation((frameId) => {
      if (typeof frameId === 'number') {
        frameCallbacks.delete(frameId);
      }
    });
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((callback) => {
        const handle = mockRunAfterInteractions(callback as () => void);
        return handle as unknown as ReturnType<
          typeof InteractionManager.runAfterInteractions
        >;
      });
    mockRunAfterInteractions.mockImplementation((callback) => ({
      cancel: jest.fn(),
      run: callback,
    }));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createScrollRef() {
    return {
      current: {
        scrollTo: jest.fn(),
      },
    } as unknown as RefObject<ScrollView | null>;
  }

  it('coalesces repeated calls into one deferred scroll with the latest y value', () => {
    const scrollViewRef = createScrollRef();
    const onScrolled = jest.fn();
    const { result } = renderHook(() =>
      useNextStepScroll(scrollViewRef, onScrolled)
    );

    result.current(100);
    result.current(220);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);

    frameCallbacks.get(1)?.(0);
    const interaction = mockRunAfterInteractions.mock.results[0]?.value as {
      run: () => void;
    };
    interaction.run();

    expect(scrollViewRef.current?.scrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 220 - SPACING.md,
    });
    expect(onScrolled).toHaveBeenCalledTimes(1);
  });

  it('cancels pending frame and interaction callbacks on unmount', () => {
    const scrollViewRef = createScrollRef();
    const onScrolled = jest.fn();
    const interactionCancel = jest.fn();
    mockRunAfterInteractions.mockReturnValueOnce({
      cancel: interactionCancel,
      run: jest.fn(),
    });
    const { result, unmount } = renderHook(() =>
      useNextStepScroll(scrollViewRef, onScrolled)
    );

    result.current(100);
    frameCallbacks.get(1)?.(0);
    unmount();

    expect(cancelAnimationFrame).not.toHaveBeenCalled();
    expect(interactionCancel).toHaveBeenCalledTimes(1);
    expect(scrollViewRef.current?.scrollTo).not.toHaveBeenCalled();
  });

  it('cancels a queued animation frame when unmounted before scheduling interactions', () => {
    const scrollViewRef = createScrollRef();
    const { result, unmount } = renderHook(() =>
      useNextStepScroll(scrollViewRef, jest.fn())
    );

    result.current(100);
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(mockRunAfterInteractions).not.toHaveBeenCalled();
    expect(scrollViewRef.current?.scrollTo).not.toHaveBeenCalled();
  });

  it('does not scroll below zero', () => {
    const scrollViewRef = createScrollRef();
    const { result } = renderHook(() =>
      useNextStepScroll(scrollViewRef, jest.fn())
    );
    // Use a value just below the top offset so the scroll target must clamp to 0.
    const testInput = SPACING.md - 1;

    result.current(testInput);
    frameCallbacks.get(1)?.(0);
    const interaction = mockRunAfterInteractions.mock.results[0]?.value as {
      run: () => void;
    };
    interaction.run();

    expect(scrollViewRef.current?.scrollTo).toHaveBeenCalledWith({
      animated: true,
      y: 0,
    });
  });

  it('does not report a scroll when the scroll view is unavailable', () => {
    // Use a null ref directly to exercise the ref-unavailable edge case.
    const scrollViewRef = {
      current: null,
    } as RefObject<ScrollView | null>;
    const onScrolled = jest.fn();
    const { result } = renderHook(() =>
      useNextStepScroll(scrollViewRef, onScrolled)
    );

    result.current(100);
    frameCallbacks.get(1)?.(0);
    const interaction = mockRunAfterInteractions.mock.results[0]?.value as {
      run: () => void;
    };
    interaction.run();

    expect(onScrolled).not.toHaveBeenCalled();
  });
});
