'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import type { MerchantData } from '@/hooks/use-merchant';

interface DeferredGoogleStoreWidgetProps {
  merchant?: Pick<MerchantData, 'custom_domain'>;
  merchantCustomDomain?: string | null;
  enabled?: boolean;
  hostname?: string;
  loadWidgetModule?: () => Promise<GoogleStoreWidgetModule>;
}

interface GoogleStoreWidgetModule {
  GoogleStoreWidget: ComponentType<
    DeferredGoogleStoreWidgetProps & { skipActivationDelay?: boolean }
  >;
}

const GOOGLE_STORE_WIDGET_DELAY_MS = 20000;

export function DeferredGoogleStoreWidget(
  props: DeferredGoogleStoreWidgetProps
) {
  const [Widget, setWidget] = useState<
    GoogleStoreWidgetModule['GoogleStoreWidget'] | null
  >(null);

  useEffect(() => {
    if (props.enabled === false || Widget) {
      return;
    }

    let cancelled = false;
    let loading = false;
    let timeoutId: number | undefined;

    const loadWidget = () => {
      if (cancelled || loading) {
        return;
      }

      loading = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }

      const widgetModule =
        props.loadWidgetModule?.() ?? import('./google-store-widget');

      void widgetModule.then((module) => {
        if (!cancelled) {
          setWidget(() => module.GoogleStoreWidget);
        }
      });
    };

    timeoutId = window.setTimeout(loadWidget, GOOGLE_STORE_WIDGET_DELAY_MS);
    window.addEventListener('pointerdown', loadWidget, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', loadWidget, { once: true });
    window.addEventListener('scroll', loadWidget, {
      once: true,
      passive: true,
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener('pointerdown', loadWidget);
      window.removeEventListener('keydown', loadWidget);
      window.removeEventListener('scroll', loadWidget);
    };
  }, [Widget, props.enabled, props.loadWidgetModule]);

  if (props.enabled === false || !Widget) {
    return null;
  }

  return <Widget {...props} skipActivationDelay />;
}
