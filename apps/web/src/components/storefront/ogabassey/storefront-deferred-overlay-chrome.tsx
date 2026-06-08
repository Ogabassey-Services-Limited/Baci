'use client';

import { OfflineNotice } from './components/OfflineNotice';
import { PopupSystem } from './components/PopupSystem';

export function StorefrontDeferredOverlayChrome() {
  return (
    <>
      <PopupSystem />
      <OfflineNotice />
    </>
  );
}
