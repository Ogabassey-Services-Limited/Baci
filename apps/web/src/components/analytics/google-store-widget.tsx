'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { MerchantData } from '@/hooks/use-merchant';
import { normalizeHostname } from './google-store-widget-utils';

export {
  normalizeHostname,
  resolveGoogleStoreWidgetPreference,
} from './google-store-widget-utils';

interface MerchantWidgetOptions {
  position?: 'LEFT_BOTTOM' | 'RIGHT_BOTTOM';
  sideMargin?: number;
  bottomMargin?: number;
  mobileSideMargin?: number;
  mobileBottomMargin?: number;
}

interface GoogleStoreWidgetProps {
  merchant?: Pick<MerchantData, 'custom_domain'>;
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
const MERCHANT_WIDGET_IFRAME_ID = 'merchantwidgetiframe';
export const MERCHANT_WIDGET_IFRAME_TITLE =
  'Google Store badge and merchant quality widget';

function resolveMerchantWidgetFrame() {
  const frameById = document.getElementById(MERCHANT_WIDGET_IFRAME_ID);

  if (frameById instanceof HTMLIFrameElement) {
    return frameById;
  }

  return document.querySelector<HTMLIFrameElement>(
    [
      'iframe[src*="google.com/shopping/merchantverse"]',
      'iframe[src*="googleusercontent.com/shopping/merchantverse"]',
    ].join(', ')
  );
}

function titleMerchantWidgetFrame() {
  const frame = resolveMerchantWidgetFrame();

  if (!frame) {
    return false;
  }

  frame.title = MERCHANT_WIDGET_IFRAME_TITLE;
  frame.setAttribute('aria-label', MERCHANT_WIDGET_IFRAME_TITLE);

  return true;
}

export function GoogleStoreWidget({
  merchant,
  merchantCustomDomain,
  enabled = true,
  hostname,
  skipActivationDelay = false,
}: GoogleStoreWidgetProps) {
  const [domainMatches, setDomainMatches] = useState(false);
  const [shouldLoadScript, setShouldLoadScript] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetStarted, setWidgetStarted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDomainMatches(false);
      return;
    }

    const merchantDomain = normalizeHostname(
      merchantCustomDomain ?? merchant?.custom_domain
    );

    if (!merchantDomain) {
      setDomainMatches(true);
      return;
    }

    const currentHostname = normalizeHostname(
      hostname || window.location.hostname
    );

    setDomainMatches(currentHostname === merchantDomain);
  }, [enabled, hostname, merchant?.custom_domain, merchantCustomDomain]);

  useEffect(() => {
    if (!enabled || !domainMatches) {
      setShouldLoadScript(false);
      return;
    }

    if (shouldLoadScript) {
      return;
    }

    if (skipActivationDelay) {
      setShouldLoadScript(true);
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
    if (
      !enabled ||
      !domainMatches ||
      !shouldLoadScript ||
      !scriptLoaded ||
      widgetStarted
    ) {
      return;
    }

    if (!window.merchantwidget?.start) {
      return;
    }

    window.merchantwidget.start({
      position: 'LEFT_BOTTOM',
      sideMargin: 24,
      bottomMargin: 24,
      mobileSideMargin: 16,
      // Ogabassey uses a fixed mobile nav; lift the widget above it.
      mobileBottomMargin: 104,
    });
    titleMerchantWidgetFrame();
    setWidgetStarted(true);
  }, [domainMatches, enabled, scriptLoaded, shouldLoadScript, widgetStarted]);

  useEffect(() => {
    if (!widgetStarted || titleMerchantWidgetFrame()) {
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
  }, [widgetStarted]);

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
