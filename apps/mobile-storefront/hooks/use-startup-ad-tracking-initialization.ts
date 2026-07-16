import { useEffect, useRef } from 'react';
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
    void initializeAdTrackingForStartup();
  }, [isInitialized, isStorageReady, isTrackingAuthorizationSettled]);
}
