import {
  Gesture,
  usePanGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';

type MockHookGesture = {
  config: unknown;
  type: string;
};

type MockComposedGesture = {
  gestures: MockHookGesture[];
  type: string;
};

describe('mobile storefront Jest gesture mock', () => {
  it('includes the pinch builder used by image zoom gestures', () => {
    expect(typeof Gesture.Pinch).toBe('function');

    const pinch = Gesture.Pinch();

    expect(typeof pinch.onStart).toBe('function');
    expect(typeof pinch.onUpdate).toBe('function');
    expect(typeof pinch.onEnd).toBe('function');
    expect(typeof pinch.onFinalize).toBe('function');
  });

  it('includes Gesture Handler 3 hook APIs used by draggable gestures', () => {
    expect(typeof usePanGesture).toBe('function');
    expect(typeof useTapGesture).toBe('function');
    expect(typeof useSimultaneousGestures).toBe('function');

    const pan = usePanGesture({ minDistance: 8 });
    const tap = useTapGesture({ maxDistance: 8 });
    const simultaneous = useSimultaneousGestures(
      pan,
      tap
    ) as unknown as MockComposedGesture;
    const mockPan = pan as unknown as MockHookGesture;
    const mockTap = tap as unknown as MockHookGesture;

    expect(mockPan).toMatchObject({
      config: { minDistance: 8 },
      type: 'pan',
    });
    expect(mockTap).toMatchObject({
      config: { maxDistance: 8 },
      type: 'tap',
    });
    expect(simultaneous).toMatchObject({
      gestures: [mockPan, mockTap],
      type: 'simultaneous',
    });
  });
});
