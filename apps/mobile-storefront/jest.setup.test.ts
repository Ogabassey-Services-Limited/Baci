import { Gesture } from 'react-native-gesture-handler';

describe('mobile storefront Jest gesture mock', () => {
  it('includes the pinch builder used by image zoom gestures', () => {
    expect(typeof Gesture.Pinch).toBe('function');

    const pinch = Gesture.Pinch();

    expect(typeof pinch.onStart).toBe('function');
    expect(typeof pinch.onUpdate).toBe('function');
    expect(typeof pinch.onEnd).toBe('function');
    expect(typeof pinch.onFinalize).toBe('function');
  });
});
