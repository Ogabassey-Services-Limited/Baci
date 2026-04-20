import { describe, expect, it, jest } from '@jest/globals';

describe('getOptionalGestureHandlerRuntime', () => {
  it('falls back when react-native-gesture-handler is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-gesture-handler', () => {
        throw new Error('module unavailable');
      });

      const { getOptionalGestureHandlerRuntime } =
        require('./optional-gesture-handler') as typeof import('./optional-gesture-handler');

      const runtime = getOptionalGestureHandlerRuntime();

      expect(runtime.Gesture).toBeNull();
      expect(typeof runtime.GestureDetector).toBe('function');
      expect(typeof runtime.GestureHandlerRootView).toBe('function');
    });
  });

  it('passes through the real gesture-handler exports when the module is available', () => {
    jest.isolateModules(() => {
      const mockGesture = { Pan: jest.fn() };
      const mockGestureDetector = () => null;
      const mockRootView = () => null;

      jest.doMock('react-native-gesture-handler', () => ({
        Gesture: mockGesture,
        GestureDetector: mockGestureDetector,
        GestureHandlerRootView: mockRootView,
      }));

      const { getOptionalGestureHandlerRuntime } =
        require('./optional-gesture-handler') as typeof import('./optional-gesture-handler');

      const runtime = getOptionalGestureHandlerRuntime();

      expect(runtime.Gesture).toBe(mockGesture);
      expect(runtime.GestureDetector).toBe(mockGestureDetector);
      expect(runtime.GestureHandlerRootView).toBe(mockRootView);
    });
  });
});
