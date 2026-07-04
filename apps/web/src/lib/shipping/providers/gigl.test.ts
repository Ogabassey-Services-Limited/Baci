import { describe, expect, it } from 'vitest';
import { GiglProvider, giglProvider } from './gigl';

describe('GiglProvider orchestrator', () => {
  it('exports the singleton and provider metadata', () => {
    expect(giglProvider).toBeInstanceOf(GiglProvider);
    expect(giglProvider).toMatchObject({
      code: 'GIGL',
      displayName: 'GIG Logistics',
      supportsDomestic: true,
      supportsInternational: true,
    });
  });

  it('documents unsupported cancellation through a typed result', async () => {
    await expect(giglProvider.cancelShipment('GIGL-WB-1')).resolves.toEqual({
      success: false,
      message:
        'GIGL shipment cancellation must be done through their customer service',
    });
  });
});
