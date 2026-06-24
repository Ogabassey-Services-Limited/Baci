'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import type { MerchantData } from '@/hooks/merchant/types';
import {
  normalizeHostname,
  resolveGoogleMerchantCenterId,
  resolveMerchantWidgetFrame,
} from './google-store-widget-utils';

export {
  normalizeHostname,
  resolveGoogleStoreWidgetPreference,
} from './google-store-widget-utils';

interface MerchantWidgetOptions {
  merchant_id?: number;
  position?: 'LEFT_BOTTOM' | 'RIGHT_BOTTOM';
  sideMargin?: number;
  bottomMargin?: number;
  mobileSideMargin?: number;
  mobileBottomMargin?: number;
}

interface GoogleStoreWidgetProps {
  merchant?: Pick<MerchantData, 'custom_domain' | 'feature_settings'>;
  merchantCustomDomain?: string | null;
  enabled?: boolean;
  hostname?: string;
  skipActivationDelay?: boolean;
}

declare global {
  interface Window {
    merchantwidget?: {
      start: (options?: MerchantWidgetOptions) => void;
    };
  }
}

const WIDGET_SCRIPT_SRC =
  'https://www.gstatic.com/shopping/merchant/merchantwidget.js';
const WIDGET_DEFER_TIMEOUT_MS = 20000;
export const MERCHANT_WIDGET_IFRAME_TITLE =
  'Google Store badge and merchant quality widget';

function titleMerchantWidgetFrame() {
  const frame = resolveMerchantWidgetFrame();

  if (!frame) {
    return false;
  }

  frame.title = MERCHANT_WIDGET_IFRAME_TITLE;
  frame.setAttribute('aria-label', MERCHANT_WIDGET_IFRAME_TITLE);

  return true;
}

function resolveDomainMatches({
  enabled,
  merchant,
  merchantCustomDomain,
  hostname,
}: Pick<
  GoogleStoreWidgetProps,
  'enabled' | 'merchant' | 'merchantCustomDomain' | 'hostname'
>): boolean {
  if (!enabled) {
    return false;
  }

  const merchantDomain = normalizeHostname(
    merchantCustomDomain ?? merchant?.custom_domain
  );

  if (!merchantDomain) {
    return true;
  }

  const currentHostname = normalizeHostname(
    hostname ||
      (typeof window !== 'undefined' ? window.location.hostname : undefined)
  );

  return currentHostname === merchantDomain;
}

export function GoogleStoreWidget({
  merchant,
  merchantCustomDomain,
  enabled = true,
  hostname,
  skipActivationDelay = false,
}: GoogleStoreWidgetProps) {
  const merchantCenterId = resolveGoogleMerchantCenterId(merchant);

  // Derive domain match during render instead of syncing it through an effect.
  const domainMatches = resolveDomainMatches({
    enabled,
    merchant,
    merchantCustomDomain,
    hostname,
  });
  const isActivatable = enabled && domainMatches;

  // When the outer shell already delayed mounting we activate immediately, so
  // seed the gate instead of flipping it through an effect on mount.
  const [shouldLoadScript, setShouldLoadScript] = useState(
    skipActivationDelay && isActivatable
  );
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const widgetStartedRef = useRef(false);
  const widgetStartKey = `${isActivatable}:${merchantCenterId ?? ''}`;
  const widgetStartKeyRef = useRef(widgetStartKey);

  // Reset/seed the deferred-load gate inline when activatability changes, so
  // re-enabling restarts the defer window without an extra stale-UI commit.
  const [wasActivatable, setWasActivatable] = useState(isActivatable);
  if (isActivatable !== wasActivatable) {
    setWasActivatable(isActivatable);
    if (!isActivatable) {
      if (shouldLoadScript) {
        setShouldLoadScript(false);
      }
    } else if (skipActivationDelay && !shouldLoadScript) {
      setShouldLoadScript(true);
    }
  }

  useEffect(() => {
    if (!enabled || !domainMatches || skipActivationDelay) {
      return;
    }

    if (shouldLoadScript) {
      return;
    }

    let cancelled = false;

    const loadScript = () => {
      if (cancelled) {
        return;
      }

      setShouldLoadScript(true);
    };

    const timeoutId = window.setTimeout(loadScript, WIDGET_DEFER_TIMEOUT_MS);

    const handleInteraction = () => {
      loadScript();
    };

    window.addEventListener('pointerdown', handleInteraction, {
      passive: true,
      once: true,
    });
    window.addEventListener('keydown', handleInteraction, { once: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);

      window.removeEventListener('pointerdown', handleInteraction);
      window.removeEventListener('keydown', handleInteraction);
    };
  }, [domainMatches, enabled, shouldLoadScript, skipActivationDelay]);

  useEffect(() => {
    if (widgetStartKeyRef.current !== widgetStartKey) {
      widgetStartKeyRef.current = widgetStartKey;
      widgetStartedRef.current = false;
    }

    if (!enabled || !domainMatches || !shouldLoadScript || !scriptLoaded) {
      return;
    }

    if (widgetStartedRef.current || !window.merchantwidget?.start) {
      return;
    }

    widgetStartedRef.current = true;

    const widgetOptions: MerchantWidgetOptions = {
      ...(merchantCenterId ? { merchant_id: Number(merchantCenterId) } : {}),
      position: 'LEFT_BOTTOM',
      sideMargin: 24,
      bottomMargin: 24,
      mobileSideMargin: 16,
      // Ogabassey uses a fixed mobile nav; lift the widget above it.
      mobileBottomMargin: 104,
    };

    window.merchantwidget.start(widgetOptions);

    if (titleMerchantWidgetFrame()) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (titleMerchantWidgetFrame()) {
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
    };
  }, [
    domainMatches,
    enabled,
    merchantCenterId,
    scriptLoaded,
    shouldLoadScript,
    widgetStartKey,
  ]);

  if (!enabled || !domainMatches || !shouldLoadScript) {
    return null;
  }

  return (
    <Script
      id="google-store-widget-script"
      src={WIDGET_SCRIPT_SRC}
      strategy="afterInteractive"
      onLoad={() => {
        setScriptLoaded(true);
      }}
    />
  );
}
