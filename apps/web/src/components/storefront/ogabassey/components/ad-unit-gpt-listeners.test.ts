import { describe, expect, it, vi } from 'vitest';
import { registerPubAdsSlotRenderListener } from './ad-unit-gpt-listeners';

type SlotRenderListener = (event: unknown) => void;

function createPubAdsService(options: { withRemove: boolean }) {
  const addEventListener = vi.fn<
    (eventType: 'slotRenderEnded', listener: SlotRenderListener) => void
  >();
  const removeEventListener = options.withRemove
    ? vi.fn<
        (eventType: 'slotRenderEnded', listener: SlotRenderListener) => void
      >()
    : undefined;

  return {
    pubads: {
      addEventListener,
      ...(removeEventListener ? { removeEventListener } : {}),
    } as unknown as googletag.PubAdsService,
    addEventListener,
    removeEventListener,
  };
}

describe('registerPubAdsSlotRenderListener', () => {
  it('registers and removes the same slotRenderEnded listener', () => {
    const { pubads, addEventListener, removeEventListener } =
      createPubAdsService({ withRemove: true });
    const listener = vi.fn();

    const cleanup = registerPubAdsSlotRenderListener(pubads, listener);

    expect(addEventListener).toHaveBeenCalledWith('slotRenderEnded', listener);

    cleanup();

    expect(removeEventListener).toHaveBeenCalledWith(
      'slotRenderEnded',
      listener
    );
  });

  it('keeps cleanup safe when GPT does not expose removeEventListener', () => {
    const { pubads, addEventListener } = createPubAdsService({
      withRemove: false,
    });
    const listener = vi.fn();

    const cleanup = registerPubAdsSlotRenderListener(pubads, listener);

    expect(addEventListener).toHaveBeenCalledWith('slotRenderEnded', listener);
    expect(cleanup).not.toThrow();
  });
});
