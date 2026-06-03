import { renderHook } from '@testing-library/react-native';
import { useDraggableFab } from './use-draggable-fab';

describe('useDraggableFab', () => {
  type MockGesture = {
    config: Record<string, unknown>;
    type: string;
  };

  it('returns the expected properties', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current).toHaveProperty('panGesture');
    expect(result.current).toHaveProperty('tapGesture');
    expect(result.current).toHaveProperty('translateX');
    expect(result.current).toHaveProperty('translateY');
    expect(result.current).toHaveProperty('scale');
    expect(result.current).toHaveProperty('isDragging');
    expect(result.current).toHaveProperty('isOverDismissZone');
    expect(result.current).toHaveProperty('isOnRight');
  });

  it('isDragging is initially false', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isDragging).toBe(false);
  });

  it('isOverDismissZone is initially false', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isOverDismissZone).toBe(false);
  });

  it('exposes a positive numeric scale shared value', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(typeof result.current.scale.value).toBe('number');
    expect(result.current.scale.value).toBeGreaterThan(0);
  });

  it('translateX and translateY start at 0', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.translateX.value).toBe(0);
    expect(result.current.translateY.value).toBe(0);
  });

  it('isOnRight is initially true', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isOnRight).toBe(true);
  });

  it('returns pan and tap gestures compatible with the Gesture Handler 3 hook API', () => {
    const { result } = renderHook(() => useDraggableFab(90));
    const { panGesture, tapGesture } = result.current as unknown as {
      panGesture: MockGesture;
      tapGesture: MockGesture;
    };

    expect(panGesture).toMatchObject({
      config: { minDistance: 8 },
      type: 'pan',
    });
    expect(tapGesture).toMatchObject({
      config: { maxDistance: 14 },
      type: 'tap',
    });
  });
});
