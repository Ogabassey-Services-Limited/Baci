import { act, renderHook } from '@testing-library/react-native';
import { NUDGE_INITIAL_DELAY } from './constants';
import { useProactiveNudge } from './use-proactive-nudge';

describe('useProactiveNudge', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the expected properties', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    expect(result.current).toHaveProperty('proactiveMsg');
    expect(result.current).toHaveProperty('nudgeFadeAnim');
    expect(result.current).toHaveProperty('dismissNudge');
  });

  it('initially has no proactive message (null)', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    expect(result.current.proactiveMsg).toBeNull();
  });

  it('nudgeFadeAnim is a Reanimated Shared Value', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    expect(result.current.nudgeFadeAnim).toHaveProperty('value');
    expect(typeof result.current.nudgeFadeAnim.value).toBe('number');
  });

  it('dismissNudge is a function', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    expect(typeof result.current.dismissNudge).toBe('function');
  });

  it('shows a proactive message after the initial delay', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    // Before delay: no message
    expect(result.current.proactiveMsg).toBeNull();

    // Advance past the initial delay — wrap in act so state updates flush
    act(() => {
      jest.advanceTimersByTime(NUDGE_INITIAL_DELAY + 100);
    });

    // After delay: message should be set to one of the proactive messages
    expect(result.current.proactiveMsg).not.toBeNull();
    expect(typeof result.current.proactiveMsg).toBe('string');
  });

  it('dismissNudge clears the current proactive message', () => {
    const { result } = renderHook(() => useProactiveNudge(false));

    // Show a message first
    act(() => {
      jest.advanceTimersByTime(NUDGE_INITIAL_DELAY + 100);
    });

    expect(result.current.proactiveMsg).not.toBeNull();

    // Dismiss the nudge — the Animated.timing callback sets msg to null
    // Use runOnlyPendingTimers to avoid infinite scheduling loops
    act(() => {
      result.current.dismissNudge();
      jest.runOnlyPendingTimers();
    });

    expect(result.current.proactiveMsg).toBeNull();
  });

  it('hides the nudge immediately when isChatOpen becomes true', () => {
    const { result, rerender } = renderHook(
      ({ isChatOpen }: { isChatOpen: boolean }) =>
        useProactiveNudge(isChatOpen),
      { initialProps: { isChatOpen: false } }
    );

    // Advance to show a message
    act(() => {
      jest.advanceTimersByTime(NUDGE_INITIAL_DELAY + 100);
    });

    expect(result.current.proactiveMsg).not.toBeNull();

    // Open chat — should hide nudge immediately
    act(() => {
      rerender({ isChatOpen: true });
    });

    expect(result.current.proactiveMsg).toBeNull();
  });

  it('does not schedule a message when isChatOpen is true from the start', () => {
    const { result } = renderHook(() => useProactiveNudge(true));

    act(() => {
      jest.advanceTimersByTime(NUDGE_INITIAL_DELAY + 100);
    });

    // Even after delay, no message shown when chat is open
    expect(result.current.proactiveMsg).toBeNull();
  });
});
