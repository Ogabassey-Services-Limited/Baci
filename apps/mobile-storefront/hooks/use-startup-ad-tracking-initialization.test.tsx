import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';
import { useStartupAdTrackingInitialization } from './use-startup-ad-tracking-initialization';

const mockInitializeAdTrackingForStartup = jest.fn<() => Promise<void>>();

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
    mockInitializeAdTrackingForStartup.mockResolvedValue(undefined);
  });

  it('waits for app initialization, storage, and ATT settlement', async () => {
    const { rerender } = renderHook<
      ReturnType<typeof useStartupAdTrackingInitialization>,
      StartupAdTrackingProps
    >(
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
    await waitFor(() => {
      expect(mockInitializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
    });
  });

  it('starts ad tracking only once after the gate opens', async () => {
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

    await waitFor(() => {
      expect(mockInitializeAdTrackingForStartup).toHaveBeenCalledTimes(1);
    });
  });

  it('reports startup readiness after initialization finishes', async () => {
    const { result } = renderHook(() =>
      useStartupAdTrackingInitialization({
        isInitialized: true,
        isStorageReady: true,
        isTrackingAuthorizationSettled: true,
      })
    );

    expect(result.current.isStartupAdTrackingReady).toBe(false);

    await waitFor(() => {
      expect(result.current.isStartupAdTrackingReady).toBe(true);
    });
  });
});
