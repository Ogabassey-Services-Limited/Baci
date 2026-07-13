import { Camera } from 'expo-camera';
import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

type CameraPermissionStatus = 'checking' | 'granted' | 'denied';
type CameraPermissionResponse = Awaited<
  ReturnType<typeof Camera.requestCameraPermissionsAsync>
>;

function resolveCameraPermissionStatus(permission: CameraPermissionResponse) {
  return permission.granted ? 'granted' : 'denied';
}

export function useCameraPermission(enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [status, setStatus] = useState<CameraPermissionStatus>(
    enabled ? 'checking' : 'granted'
  );
  const [prevEnabled, setPrevEnabled] = useState(enabled);

  // Adjust permission state inline during render when `enabled` changes so the
  // UI never commits a stale frame (https://react.dev/learn/you-might-not-need-an-effect).
  if (enabled !== prevEnabled) {
    setPrevEnabled(enabled);
    if (enabled) {
      setStatus('checking');
    } else {
      setCanAskAgain(true);
      setStatus('granted');
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies(attempt): `attempt` is an intentional retrigger — retryPermission() bumps it to force a fresh permission request.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;
    Camera.requestCameraPermissionsAsync()
      .then((permission) => {
        if (isActive) {
          setCanAskAgain(permission.canAskAgain);
          setStatus(resolveCameraPermissionStatus(permission));
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn('[BNPLCheckout] Camera permission request failed', {
          message,
        });
        if (isActive) {
          setStatus('denied');
        }
      });

    return () => {
      isActive = false;
    };
  }, [attempt, enabled]);

  useEffect(() => {
    if (!enabled) return;

    let isActive = true;
    const refreshPermission = () => {
      Camera.getCameraPermissionsAsync()
        .then((permission) => {
          if (!isActive) return;
          setCanAskAgain(permission.canAskAgain);
          setStatus(resolveCameraPermissionStatus(permission));
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          console.warn('[BNPLCheckout] Camera permission refresh failed', {
            message,
          });
        });
    };

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          refreshPermission();
        }
      }
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [enabled]);

  return {
    canAskAgain,
    retry: () => {
      setStatus('checking');
      setAttempt((currentAttempt) => currentAttempt + 1);
    },
    status,
  };
}
