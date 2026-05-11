'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import type { MerchantData } from '@/hooks/merchant/types';

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
const MAX_DEFERRED_WIDGET_LOAD_RETRIES = 2;

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
    let deferredLoadRetryCount = 0;
    let timeoutId: number | undefined;

    function clearLoadTimeout() {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    }

    function scheduleDeferredLoad() {
      clearLoadTimeout();
      timeoutId = window.setTimeout(loadWidget, GOOGLE_STORE_WIDGET_DELAY_MS);
    }

    function removeDeferredWidgetListeners() {
      window.removeEventListener('pointerdown', loadWidget);
      window.removeEventListener('keydown', loadWidget);
    }

    function loadWidget(event?: Event) {
      if (cancelled || loading) {
        return;
      }

      if (event) {
        deferredLoadRetryCount = 0;
      }

      loading = true;
      clearLoadTimeout();

      const widgetModule = Promise.resolve().then(
        () => props.loadWidgetModule?.() ?? import('./google-store-widget')
      );

      void widgetModule
        .then((module) => {
          if (!cancelled) {
            deferredLoadRetryCount = 0;
            removeDeferredWidgetListeners();
            setWidget(() => module.GoogleStoreWidget);
          }
        })
        .catch(() => {
          if (!cancelled) {
            loading = false;
            if (deferredLoadRetryCount < MAX_DEFERRED_WIDGET_LOAD_RETRIES) {
              deferredLoadRetryCount += 1;
              scheduleDeferredLoad();
            }
          }
        });
    }

    scheduleDeferredLoad();
    window.addEventListener('pointerdown', loadWidget, {
      passive: true,
    });
    window.addEventListener('keydown', loadWidget);

    return () => {
      cancelled = true;
      clearLoadTimeout();
      removeDeferredWidgetListeners();
    };
  }, [Widget, props.enabled, props.loadWidgetModule]);

  if (props.enabled === false || !Widget) {
    return null;
  }

  return <Widget {...props} skipActivationDelay />;
}
