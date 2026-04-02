'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import type { MerchantData } from '@/hooks/use-merchant';

interface MerchantWidgetOptions {
  position?: 'LEFT_BOTTOM' | 'RIGHT_BOTTOM';
  sideMargin?: number;
  bottomMargin?: number;
  mobileSideMargin?: number;
  mobileBottomMargin?: number;
}

interface GoogleStoreWidgetProps {
  merchant: MerchantData;
  enabled?: boolean;
  hostname?: string;
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

export function normalizeHostname(value?: string) {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

export function resolveGoogleStoreWidgetPreference(
  merchant?: MerchantData
): boolean | undefined {
  const directPreference =
    merchant?.feature_settings?.google_store_widget_enabled;

  if (typeof directPreference === 'boolean') {
    return directPreference;
  }

  // MerchantData.feature_settings carries loose keys, so we cast to inspect
  // nested custom_settings here and still rely on runtime typeof checks below.
  const featureSettings = merchant?.feature_settings as
    | Record<string, unknown>
    | undefined;
  const customSettings = featureSettings?.custom_settings as
    | Record<string, unknown>
    | undefined;
  const customPreference = customSettings?.google_store_widget_enabled;

  return typeof customPreference === 'boolean' ? customPreference : undefined;
}

export function GoogleStoreWidget({
  merchant,
  enabled = true,
  hostname,
}: GoogleStoreWidgetProps) {
  const [domainMatches, setDomainMatches] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [widgetStarted, setWidgetStarted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDomainMatches(false);
      return;
    }

    const merchantDomain = normalizeHostname(merchant.custom_domain);

    if (!merchantDomain) {
      setDomainMatches(true);
      return;
    }

    const currentHostname = normalizeHostname(
      hostname || window.location.hostname
    );

    setDomainMatches(currentHostname === merchantDomain);
  }, [enabled, hostname, merchant.custom_domain]);

  useEffect(() => {
    if (!enabled || !domainMatches || !scriptLoaded || widgetStarted) {
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
    setWidgetStarted(true);
  }, [domainMatches, enabled, scriptLoaded, widgetStarted]);

  if (!enabled || !domainMatches) {
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
