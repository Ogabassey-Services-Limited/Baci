import { describe, expect, it } from 'vitest';
import { copyFor } from './gigl-tracking-notification-copy';

describe('GIGL tracking notification copy', () => {
  it('uses explicit copy for provider lifecycle kinds', () => {
    expect(copyFor('pickup_delayed', 'provider detail')).toEqual({
      title: 'Pickup delayed',
      body: 'Your GIG Logistics pickup is taking longer than expected.',
    });
  });

  it('uses the event description only for unknown kinds', () => {
    expect(copyFor('unknown_kind', 'provider detail')).toEqual({
      title: 'Shipment update',
      body: 'provider detail',
    });
  });
});
