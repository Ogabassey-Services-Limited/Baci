import { describe, expect, it, vi } from 'vitest';
import { GiglDeliveryType, PickupOptions } from './gigl.constants';
import {
  createGiglQuoteSelections,
  runGiglQuoteSelections,
} from './gigl.quote-selections';

describe('runGiglQuoteSelections', () => {
  it('builds standard and faster selections for one fulfillment mode', () => {
    expect(createGiglQuoteSelections(PickupOptions.ServiceCentre)).toEqual([
      {
        deliveryType: GiglDeliveryType.GoStandard,
        pickupOption: PickupOptions.ServiceCentre,
      },
      {
        deliveryType: GiglDeliveryType.GoFaster,
        pickupOption: PickupOptions.ServiceCentre,
      },
    ]);
  });

  it('isolates a failed provider option without discarding successful quotes', async () => {
    const log = vi.fn();
    const result = await runGiglQuoteSelections({
      selections: [
        {
          deliveryType: GiglDeliveryType.GoStandard,
          pickupOption: PickupOptions.HomeDelivery,
        },
        {
          deliveryType: GiglDeliveryType.GoFaster,
          pickupOption: PickupOptions.HomeDelivery,
        },
      ],
      signal: new AbortController().signal,
      timeoutMs: 5000,
      log,
      fetchQuote: vi
        .fn()
        .mockResolvedValueOnce({ id: 'quote' })
        .mockRejectedValueOnce(new Error('provider failure')),
    });

    expect(result).toEqual([{ id: 'quote' }, null]);
    expect(log).toHaveBeenCalledWith(
      'error',
      'GIGL quote option failed',
      expect.objectContaining({ error: 'Error: provider failure' })
    );
  });
});
