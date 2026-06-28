import * as Application from 'expo-application';
import { usePathname } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { getRuntimePlatform } from '@/config/runtime-platform';
import { BASE_URL } from '@/lib/api-base-url';
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

function getSupportedPlatform() {
  const platform = getRuntimePlatform();
  return platform === 'android' || platform === 'ios'
    ? platform
    : 'unsupported';
}

// Hoisted: try/finally in a component body blocks React Compiler.
async function runMobileUpdateCheck(params: {
  hasDeferredCheckRef: { current: boolean };
  hasPrompt: boolean;
  inFlightRef: { current: boolean };
  pathname: string;
  setPrompt: (prompt: MobileUpdatePrompt) => void;
}) {
  if (params.inFlightRef.current || params.hasPrompt) return;
  params.inFlightRef.current = true;

  try {
    const result = await resolveMobileUpdatePrompt({
      apiBaseUrl: BASE_URL,
      buildNumber: Application.nativeBuildVersion,
      channel: null,
      checkForUpdateAsync: async () => ({ isAvailable: false }),
      isOtaEnabled: false,
      nativeVersion: Application.nativeApplicationVersion,
      pathname: params.pathname,
      platform: getSupportedPlatform(),
      runtimeVersion: null,
    });

    switch (result.kind) {
      case 'deferred':
        params.hasDeferredCheckRef.current = true;
        return;
      case 'none':
        return;
      default:
        if (result.kind === 'native-required' && !result.storeUrl) {
          if (__DEV__) {
            console.warn(
              '[MobileUpdateController] required native update omitted store URL; failing open'
            );
          }
          return;
        }
        params.setPrompt(result);
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('[MobileUpdateController] update check failed', error);
    }
  } finally {
    params.inFlightRef.current = false;
  }
}

export function MobileUpdateController() {
  const pathname = usePathname();
  const [prompt, setPrompt] = useState<MobileUpdatePrompt | null>(null);
  const inFlightRef = useRef(false);
  const hasDeferredCheckRef = useRef(false);

  const runCheck = useEffectEvent(() =>
    runMobileUpdateCheck({
      hasDeferredCheckRef,
      hasPrompt: prompt !== null,
      inFlightRef,
      pathname,
      setPrompt,
    })
  );

  useEffect(() => {
    void runCheck();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToMobileUpdateChecks(() => {
      void runCheck();
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
      void runCheck();
    }
  }, [pathname]);

  const handleAccept = async () => {
    if (!prompt) return;

    try {
      // Admin is native-only (isOtaEnabled: false), so the check never yields
      // an 'ota-available' prompt; the guard also narrows the union to the
      // native variants that carry a storeUrl.
      if (prompt.kind !== 'ota-available' && prompt.storeUrl) {
        await Linking.openURL(prompt.storeUrl);
      }

      if (prompt.kind === 'native-recommended') {
        setPrompt(null);
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[MobileUpdateController] update action failed', error);
      }
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
