'use client';

import { lazy, Suspense } from 'react';

const DeferredPopupSystem = lazy(async () => {
  const module = await import('./components/PopupSystem');
  return { default: module.PopupSystem };
});
const DeferredOfflineNotice = lazy(async () => {
  const module = await import('./components/OfflineNotice');
  return { default: module.OfflineNotice };
});

export function StorefrontDeferredOverlayChrome() {
  return (
    <Suspense fallback={null}>
      <DeferredPopupSystem />
      <DeferredOfflineNotice />
    </Suspense>
  );
}
