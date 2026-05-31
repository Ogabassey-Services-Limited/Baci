import { renderHook } from '@testing-library/react-native';
import { useDraggableFab } from './use-draggable-fab';

describe('useDraggableFab', () => {
  it('returns the expected properties', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current).toHaveProperty('pan');
    expect(result.current).toHaveProperty('panResponder');
    expect(result.current).toHaveProperty('pulseAnim');
    expect(result.current).toHaveProperty('isDragging');
    expect(result.current).toHaveProperty('hasMoved');
    expect(result.current).toHaveProperty('isOnRight');
    expect(result.current).toHaveProperty('isOverDismissZone');
  });

  it('isDragging is initially false', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isDragging).toBe(false);
  });

  it('isOverDismissZone is initially false', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isOverDismissZone).toBe(false);
  });

  it('hasMoved.current is initially false', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.hasMoved.current).toBe(false);
  });

  it('panResponder has panHandlers property', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.panResponder).toHaveProperty('panHandlers');
  });

  it('pan is an Animated.ValueXY instance with x and y', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.pan).toHaveProperty('x');
    expect(result.current.pan).toHaveProperty('y');
  });

  it('pulseAnim is an Animated.Value', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    // Animated.Value has addListener and removeListener
    expect(typeof result.current.pulseAnim.addListener).toBe('function');
    expect(typeof result.current.pulseAnim.removeListener).toBe('function');
  });

  it('isOnRight.current is initially true (FAB starts on right side)', () => {
    const { result } = renderHook(() => useDraggableFab(90));

    expect(result.current.isOnRight.current).toBe(true);
  });

  it('works with different bottomOffset values', () => {
    const { result: result0 } = renderHook(() => useDraggableFab(0));
    const { result: result120 } = renderHook(() => useDraggableFab(120));

    // Both should initialize without errors
    expect(result0.current.isDragging).toBe(false);
    expect(result120.current.isDragging).toBe(false);
  });
});
