import * as Application from 'expo-application';
import { usePathname } from 'expo-router';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform } from 'react-native';
import { EXPO_PUBLIC_API_URL } from '@/env';
import { createLogger } from '@/lib/logger';
import { MobileUpdateModal } from './MobileUpdateModal';
import {
  type MobileUpdatePrompt,
  resolveMobileUpdatePrompt,
} from './mobile-update-check';
import {
  requestMobileUpdateCheck,
  subscribeToMobileUpdateChecks,
} from './mobile-update-events';
import { shouldDeferMobileUpdatePrompt } from './mobile-update-route-safety';

const log = createLogger('MobileUpdateController');

function getSupportedPlatform() {
  return Platform.OS === 'android' || Platform.OS === 'ios'
    ? Platform.OS
    : 'unsupported';
}

function canUseOtaUpdates() {
  return !__DEV__ && Boolean(Updates.isEnabled && Updates.runtimeVersion);
}

export function MobileUpdateController() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<MobileUpdatePrompt | null>(null);
  const inFlightRef = useRef(false);
  const hasDeferredCheckRef = useRef(false);
  const runCheckRef = useRef<() => Promise<void>>(async () => undefined);

  runCheckRef.current = async () => {
    if (inFlightRef.current || prompt) return;
    inFlightRef.current = true;

    try {
      const result = await resolveMobileUpdatePrompt({
        apiBaseUrl: EXPO_PUBLIC_API_URL,
        buildNumber: Application.nativeBuildVersion,
        channel: Updates.channel,
        checkForUpdateAsync: Updates.checkForUpdateAsync,
        isOtaEnabled: canUseOtaUpdates(),
        nativeVersion: Application.nativeApplicationVersion,
        pathname,
        platform: getSupportedPlatform(),
        runtimeVersion: Updates.runtimeVersion,
      });

      switch (result.kind) {
        case 'deferred':
          hasDeferredCheckRef.current = true;
          return;
        case 'none':
          return;
        default:
          setPrompt(result);
      }
    } catch (error) {
      log.warn('Mobile update check failed', error);
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    void runCheckRef.current();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMobileUpdateChecks(() => {
      void runCheckRef.current();
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        requestMobileUpdateCheck('foreground');
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (
      hasDeferredCheckRef.current &&
      !shouldDeferMobileUpdatePrompt(pathname)
    ) {
      hasDeferredCheckRef.current = false;
      void runCheckRef.current();
    }
  }, [pathname]);

  const handleAccept = async () => {
    if (!prompt) return;

    try {
      if (prompt.kind === 'ota-available') {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
        return;
      }

      if (prompt.storeUrl) {
        await Linking.openURL(prompt.storeUrl);
      }

      if (prompt.kind === 'native-recommended') {
        setPrompt(null);
      }
    } catch (error) {
      log.warn('Mobile update action failed', error);
      if (prompt.kind !== 'native-required') {
        setPrompt(null);
      }
    }
  };

  const handleDismiss = () => {
    if (prompt?.kind !== 'native-required') {
      setPrompt(null);
    }
  };

  return (
    <MobileUpdateModal
      visible={prompt !== null}
      prompt={prompt}
      onAccept={handleAccept}
      onDismiss={handleDismiss}
    />
  );
}
