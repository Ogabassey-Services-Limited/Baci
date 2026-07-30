import '@testing-library/jest-dom/vitest';
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  callbacks,
  nativeFieldState,
  renderDetailsCard,
  resetDetailsCardMocks,
} from './StoreSettingsDetailsCard.test-helpers';

describe('StoreSettingsDetailsCard country and address', () => {
  beforeEach(resetDetailsCardMocks);

  it('resolves persisted country names for phone and address fields', () => {
    renderDetailsCard({
      address: '12 Oxford Street',
      businessName: 'Baci Ghana',
      countryCode: 'Ghana',
      countryLabel: 'Ghana',
      currency: 'GHS',
      phone: '+233201234567',
      slug: 'baci-ghana',
      supportPhone: '+233701234567',
    });

    expect(nativeFieldState.phoneProps[0]).toMatchObject({ defaultCode: 'GH' });
    expect(nativeFieldState.phoneProps[1]).toMatchObject({ defaultCode: 'GH' });
    expect(nativeFieldState.addressProps).toMatchObject({ countryCode: 'GH' });
  });

  it('configures address suggestions for the selected country', () => {
    renderDetailsCard();

    expect(nativeFieldState.addressProps).toMatchObject({
      address: '12 Allen Avenue',
      countryCode: 'NG',
      googleMapsApiKey: 'maps-test-key',
    });
  });

  it('keeps manual address entry when Google Places is not configured', () => {
    renderDetailsCard({ googleMapsApiKey: undefined });

    expect(screen.getByLabelText('Business Address')).toHaveValue(
      '12 Allen Avenue'
    );
    fireEvent.change(screen.getByLabelText('Business Address'), {
      target: { value: '14 Bode Thomas' },
    });
    expect(callbacks.onAddressChange).toHaveBeenCalledWith('14 Bode Thomas');
  });
});
