'use client';

import type { ComponentType, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { BannerCarouselProps } from './BannerCarousel';
import { useDeferredActivation } from './deferred-shell-feature';

interface DeferredBannerCarouselModule {
  BannerCarousel: ComponentType<BannerCarouselProps>;
}

export interface DeferredBannerCarouselProps extends BannerCarouselProps {
  activateOnIdle?: boolean;
  activateOnInteraction?: boolean;
  enabled?: boolean;
  fallback?: ReactNode;
  loadBannerCarouselModule?: () => Promise<DeferredBannerCarouselModule>;
  timeoutMs?: number;
}

const loadDefaultBannerCarouselModule = () => import('./BannerCarousel');

export function DeferredBannerCarousel({
  activateOnIdle = false,
  activateOnInteraction = false,
  enabled = true,
  fallback = null,
  loadBannerCarouselModule = loadDefaultBannerCarouselModule,
  timeoutMs = 1,
  ...bannerCarouselProps
}: DeferredBannerCarouselProps) {
  const [BannerCarouselComponent, setBannerCarouselComponent] =
    useState<ComponentType<BannerCarouselProps> | null>(null);
  const isActivated = useDeferredActivation({
    activateOnIdle,
    activateOnInteraction,
    enabled,
    timeoutMs,
  });

  useEffect(() => {
    if (!isActivated || BannerCarouselComponent) {
      return;
    }

    let cancelled = false;

    void loadBannerCarouselModule()
      .then((module) => {
        if (!cancelled) {
          setBannerCarouselComponent(() => module.BannerCarousel);
        }
      })
      .catch((error: unknown) => {
        console.error(
          '[DeferredBannerCarousel] Failed to load BannerCarousel module',
          error
        );
        if (!cancelled) {
          setBannerCarouselComponent(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [BannerCarouselComponent, isActivated, loadBannerCarouselModule]);

  if (!isActivated || !BannerCarouselComponent) {
    return fallback;
  }

  return <BannerCarouselComponent {...bannerCarouselProps} />;
}
