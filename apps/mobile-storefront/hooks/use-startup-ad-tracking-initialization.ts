import { useEffect, useRef, useState } from 'react';
import { initializeAdTrackingForStartup } from '@/services/initialize-ad-tracking-for-startup';

interface UseStartupAdTrackingInitializationOptions {
  isInitialized: boolean;
  isStorageReady: boolean;
  isTrackingAuthorizationSettled: boolean;
}

export function useStartupAdTrackingInitialization({
  isInitialized,
  isStorageReady,
  isTrackingAuthorizationSettled,
}: UseStartupAdTrackingInitializationOptions) {
  const hasInitializedAdTrackingRef = useRef(false);
  const [isStartupAdTrackingReady, setIsStartupAdTrackingReady] =
    useState(false);

  useEffect(() => {
    if (
      !isInitialized ||
      !isStorageReady ||
      !isTrackingAuthorizationSettled ||
      hasInitializedAdTrackingRef.current
    ) {
      return;
    }

    hasInitializedAdTrackingRef.current = true;
    let isMounted = true;

    void initializeAdTrackingForStartup().finally(() => {
      if (isMounted) {
        setIsStartupAdTrackingReady(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isInitialized, isStorageReady, isTrackingAuthorizationSettled]);

  return { isStartupAdTrackingReady };
}
