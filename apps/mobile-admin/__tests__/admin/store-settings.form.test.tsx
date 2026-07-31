import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { COUNTRIES } from '@/constants/countries';
import { APP_KEYBOARD_CONTAINER_LABEL } from '../auth/app-keyboard-container.mock';
import {
  defaultMerchant,
  resetStoreSettingsMocks,
} from './store-settings.test-helpers';
import { mocks } from './store-settings.test-mocks';
import StoreSettingsScreen from './store-settings.test-subject';

const DEFAULT_COUNTRY = COUNTRIES[0];

describe('StoreSettingsScreen form', () => {
  beforeEach(resetStoreSettingsMocks);

  it('renders inside the shared form shell and updates country state from the picker', () => {
    render(<StoreSettingsScreen />);
    expect(
      screen.getByRole('region', { name: APP_KEYBOARD_CONTAINER_LABEL })
    ).toBeInTheDocument();
    expect(screen.getByText('Business: Baci Foods')).toBeInTheDocument();
    expect(screen.getByText('Country: Nigeria')).toBeInTheDocument();
    expect(screen.getByText('Currency: NGN')).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Open country picker' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Choose Ghana' }));
    expect(screen.getByText('Country: Ghana')).toBeInTheDocument();
    expect(screen.getByText('Currency: GHS')).toBeInTheDocument();
  });

  it('sends only the edited column when one field changes', async () => {
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: defaultMerchant.updated_at,
      merchantId: defaultMerchant.id,
      settings: { business_name: 'Baci Foods Ltd' },
    });
    expect(await screen.findByText('Success!')).toBeInTheDocument();
  });

  it('treats whitespace-only persisted slugs as first-time slug setup', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { ...defaultMerchant, slug: '   ' },
      isLoading: false,
    });
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Yodha Shopping' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: defaultMerchant.updated_at,
      merchantId: defaultMerchant.id,
      settings: { business_name: 'Yodha Shopping', slug: 'yodha-shopping' },
    });
  });

  it('guards saves with the loaded updated_at concurrency token', async () => {
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith(
      expect.objectContaining({ expectedUpdatedAt: defaultMerchant.updated_at })
    );
  });

  it('shows a conflict error when the OCC guard detects a stale write', async () => {
    mocks.updateMerchantIdentitySettings.mockRejectedValue(
      new Error(
        'These settings changed elsewhere. Reopen the page and try again.'
      )
    );
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Business Name'), {
      target: { value: 'Baci Foods Ltd' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    expect(await screen.findByText('Update Failed')).toBeInTheDocument();
    expect(
      screen.getByText(
        'These settings changed elsewhere. Reopen the page and try again.'
      )
    ).toBeInTheDocument();
    expect(mocks.invalidateStoreReadiness).not.toHaveBeenCalled();
  });

  it('keeps phone and support_phone as distinct columns instead of collapsing them', async () => {
    render(<StoreSettingsScreen />);
    expect(screen.getByLabelText('Phone Number')).toHaveValue(
      defaultMerchant.phone
    );
    expect(screen.getByLabelText('Support Phone')).toHaveValue(
      defaultMerchant.support_phone
    );
    fireEvent.change(screen.getByLabelText('Support Phone'), {
      target: { value: '+2349999999999' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: defaultMerchant.updated_at,
      merchantId: defaultMerchant.id,
      settings: { support_phone: '+2349999999999' },
    });
    const [{ settings }] = mocks.updateMerchantIdentitySettings.mock.calls[0];
    expect(settings).not.toHaveProperty('phone');
  });

  it('does not save the prefilled merchant email with an unrelated phone edit', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: {
        ...defaultMerchant,
        email: 'owner@usebaci.com',
        phone: '',
        support_email: null,
        support_phone: null,
      },
      isLoading: false,
    });
    render(<StoreSettingsScreen />);
    fireEvent.change(screen.getByLabelText('Phone Number'), {
      target: { value: '+2348011111111' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: defaultMerchant.updated_at,
      merchantId: defaultMerchant.id,
      settings: { phone: '+2348011111111' },
    });
  });

  it('does not run the mutation when nothing changed (empty diff)', async () => {
    render(<StoreSettingsScreen />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    expect(await screen.findByText('Success!')).toBeInTheDocument();
    expect(mocks.updateMerchantIdentitySettings).not.toHaveBeenCalled();
  });

  it('writes the default country/currency when they were never persisted', async () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { ...defaultMerchant, country: null, payout_currency: null },
      isLoading: false,
    });
    render(<StoreSettingsScreen />);
    expect(
      screen.getByText(`Country: ${DEFAULT_COUNTRY.name}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Currency: ${DEFAULT_COUNTRY.currency}`)
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Save store settings' })
    );
    await waitFor(() =>
      expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledTimes(1)
    );
    expect(mocks.updateMerchantIdentitySettings).toHaveBeenCalledWith({
      expectedUpdatedAt: defaultMerchant.updated_at,
      merchantId: defaultMerchant.id,
      settings: {
        country: DEFAULT_COUNTRY.code,
        payout_currency: DEFAULT_COUNTRY.currency,
      },
    });
  });
});
