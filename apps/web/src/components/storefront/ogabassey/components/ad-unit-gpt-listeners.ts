export interface GoogleSlotRenderEndedEvent {
  slot: googletag.Slot;
  isEmpty: boolean;
}

type PubAdsServiceWithOptionalRemove = googletag.PubAdsService & {
  removeEventListener?: (
    eventType: 'slotRenderEnded',
    listener: (event: unknown) => void
  ) => void;
};

export function registerPubAdsSlotRenderListener(
  pubads: googletag.PubAdsService,
  listener: (event: unknown) => void
) {
  pubads.addEventListener('slotRenderEnded', listener);

  return () => {
    const removablePubads = pubads as PubAdsServiceWithOptionalRemove;
    removablePubads.removeEventListener?.('slotRenderEnded', listener);
  };
}
