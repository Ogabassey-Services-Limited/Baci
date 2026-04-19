import { describe, expect, it, jest } from '@jest/globals';

describe('getOptionalGestureHandlerRuntime', () => {
  it('falls back when react-native-gesture-handler is unavailable', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-gesture-handler', () => {
        throw new Error('module unavailable');
      });

      const {
        getOptionalGestureHandlerRuntime,
      } = require('./optional-gesture-handler') as typeof import('./optional-gesture-handler');

      const runtime = getOptionalGestureHandlerRuntime();

      expect(runtime.Gesture).toBeNull();
      expect(typeof runtime.GestureDetector).toBe('function');
      expect(typeof runtime.GestureHandlerRootView).toBe('function');
    });
  });
});
