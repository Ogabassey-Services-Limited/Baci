'use client';

import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { AdUnitProps } from './AdUnit';
import { useDeferredActivation } from './deferred-shell-feature';

interface DeferredAdUnitModule {
  AdUnit: ComponentType<AdUnitProps>;
}

export interface DeferredAdUnitProps extends AdUnitProps {
  activateOnIdle?: boolean;
  activateOnInteraction?: boolean;
  enabled?: boolean;
  fallback?: ReactNode;
  loadAdUnitModule?: () => Promise<DeferredAdUnitModule>;
  timeoutMs?: number;
}

const loadDefaultAdUnitModule = () => import('./AdUnit');

export function DeferredAdUnit({
  activateOnIdle = false,
  activateOnInteraction = false,
  enabled = true,
  fallback = null,
  loadAdUnitModule = loadDefaultAdUnitModule,
  timeoutMs = 1,
  ...adUnitProps
}: DeferredAdUnitProps) {
  const [AdUnitComponent, setAdUnitComponent] =
    useState<ComponentType<AdUnitProps> | null>(null);
  const isActivated = useDeferredActivation({
    activateOnIdle,
    activateOnInteraction,
    enabled,
    timeoutMs,
  });

  useEffect(() => {
    if (!isActivated || AdUnitComponent) {
      return;
    }

    let cancelled = false;

    void loadAdUnitModule()
      .then((module) => {
        if (!cancelled) {
          setAdUnitComponent(() => module.AdUnit);
        }
      })
      .catch((error: unknown) => {
        console.error('[DeferredAdUnit] Failed to load AdUnit module', error);
        if (!cancelled) {
          setAdUnitComponent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [AdUnitComponent, isActivated, loadAdUnitModule]);

  if (!isActivated || !AdUnitComponent) {
    return fallback;
  }

  return <AdUnitComponent {...adUnitProps} />;
}
