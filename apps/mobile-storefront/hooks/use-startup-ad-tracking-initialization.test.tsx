import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook } from '@testing-library/react-native';
import { useStartupAdTrackingInitialization } from './use-startup-ad-tracking-initialization';

const mockInitializeAdTrackingForStartup = jest.fn();

jest.mock('@/services/initialize-ad-tracking-for-startup', () => ({
  initializeAdTrackingForStartup: () => mockInitializeAdTrackingForStartup(),
}));

interface StartupAdTrackingProps {
  isInitialized: boolean;
  isStorageReady: boolean;
  isTrackingAuthorizationSettled: boolean;
}

describe('useStartupAdTrackingInitialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('waits for app initialization, storage, and ATT settlement', () => {
    const { rerender } = renderHook<void, StartupAdTrackingProps>(
      ({ isInitialized, isStorageReady, isTrackingAuthorizationSettled }) =>
        useStartupAdTrackingInitialization({
          isInitialized,
          isStorageReady,
          isTrackingAuthorizationSettled,
        }),
      {
        initialProps: {
          isInitialized: false,
          isStorageReady: false,
          isTrackingAuthorizationSettled: false,
        },
      }
    );

    expect(mockInitializeAdTrackingForStartup).not.toHaveBeenCalled();

    rerender({
      isInitialized: true,
      isStorageReady: true,
      isTrackingAuthorizationSettled: false,
    });
    expect(mockInitializeAdTrackingForStartup).not.toHaveBeenCalled();

    rerender({
      isInitialized: true,
      isStorageReady: true,
      isTrackingAuthorizationSettled: true,
    });
    expect(mockInitializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
  });

  it('starts ad tracking only once after the gate opens', () => {
    const props = {
      isInitialized: true,
      isStorageReady: true,
      isTrackingAuthorizationSettled: true,
    };
    const { rerender } = renderHook(
      () => useStartupAdTrackingInitialization(props),
      { initialProps: props }
    );

    rerender(props);

    expect(mockInitializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
  });
});
