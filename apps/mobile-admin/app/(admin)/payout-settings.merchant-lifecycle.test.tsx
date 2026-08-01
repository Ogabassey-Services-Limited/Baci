import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadPayoutSettingsScreen,
  payoutSettingsMocks,
  resetPayoutSettingsMocks,
} from '../../__tests__/admin/payout-settings.test-support';

describe('PayoutSettingsScreen merchant lifecycle', () => {
  let PayoutSettingsScreen: ComponentType;

  beforeEach(async () => {
    resetPayoutSettingsMocks();
    PayoutSettingsScreen = await loadPayoutSettingsScreen();
  });

  it('seeds bank details and the payout business name from the active accessible merchant', () => {
    payoutSettingsMocks.activeMerchantData = {
      id: 'accessible-merchant',
      bank_account_number: '2222222222',
      bank_code: '001',
      bank_name: 'GTBank',
      business_name: 'Accessible Store',
    };
    payoutSettingsMocks.accountName = 'Accessible Store Ltd';
    render(<PayoutSettingsScreen />);

    expect(screen.getByPlaceholderText('0123456789')).toHaveValue('2222222222');
    expect(screen.getByText('GTBank')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(payoutSettingsMocks.savePayoutSettings.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '2222222222',
        bankCode: '001',
        businessName: 'Accessible Store',
      }),
      expect.any(Object)
    );
  });

  it('clears a prior merchant bank selection when the active merchant has no saved bank', () => {
    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-a',
      bank_account_number: '1111111111',
      bank_code: '001',
      bank_name: 'GTBank',
      business_name: 'First Store',
    };
    const rendered = render(<PayoutSettingsScreen />);
    expect(screen.getByText('GTBank')).toBeInTheDocument();

    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-b',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Second Store',
    };
    rendered.rerender(<PayoutSettingsScreen />);

    expect(screen.getByText('Select your bank')).toBeInTheDocument();
  });

  it('returns to the checklist without a success alert after a checklist payout save', () => {
    payoutSettingsMocks.accountName = 'Baci Store';
    payoutSettingsMocks.routeParams = { from: 'setup' };
    render(<PayoutSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('0123456789'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const options = payoutSettingsMocks.savePayoutSettings.mutate.mock
      .calls[0]?.[1] as { onSuccess?: () => void } | undefined;
    options?.onSuccess?.();

    expect(payoutSettingsMocks.routerBack).toHaveBeenCalledTimes(1);
    expect(payoutSettingsMocks.alert).not.toHaveBeenCalledWith(
      'Success',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('ignores payout completion callbacks after the merchant switches', () => {
    payoutSettingsMocks.accountName = 'Baci Store';
    payoutSettingsMocks.routeParams = { from: 'setup' };
    const rendered = render(<PayoutSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('0123456789'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const callbacks = payoutSettingsMocks.savePayoutSettings.mutate.mock
      .calls[0]?.[1] as
      | {
          onError?: (error: Error) => void;
          onSuccess?: () => void;
        }
      | undefined;
    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-2',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Second Store',
    };
    rendered.rerender(<PayoutSettingsScreen />);
    callbacks?.onSuccess?.();
    callbacks?.onError?.(new Error('Save failed'));

    expect(payoutSettingsMocks.routerBack).not.toHaveBeenCalled();
    expect(payoutSettingsMocks.alert).not.toHaveBeenCalled();
  });
});
