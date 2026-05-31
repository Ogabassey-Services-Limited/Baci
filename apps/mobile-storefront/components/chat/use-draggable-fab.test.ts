import { renderHook } from '@testing-library/react-native';
import { useDraggableFab } from './use-draggable-fab';

describe('useDraggableFab', () => {
  it('returns the expected properties', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current).toHaveProperty('composedGesture');
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

  it('scale starts at 1.05 due to mock pulse loop', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.scale.value).toBe(1.05);
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
});
