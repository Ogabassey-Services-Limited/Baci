import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadPayoutSettingsScreen,
  payoutSettingsMocks,
  resetPayoutSettingsMocks,
} from '../../__tests__/admin/payout-settings.test-support';

describe('PayoutSettingsScreen validation', () => {
  let PayoutSettingsScreen: ComponentType;

  beforeEach(async () => {
    resetPayoutSettingsMocks();
    PayoutSettingsScreen = await loadPayoutSettingsScreen();
  });

  it('renders bank and account fields in the settings form', () => {
    render(<PayoutSettingsScreen />);

    expect(screen.getByText('Bank Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Select bank')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0123456789')).toBeInTheDocument();
  });

  it('blocks save when account verification has not produced an account name', () => {
    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };
    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      payoutSettingsMocks.savePayoutSettings.mutate
    ).not.toHaveBeenCalled();
    expect(payoutSettingsMocks.alert).toHaveBeenCalledWith(
      'Error',
      'Please wait for account verification'
    );
  });

  it('blocks save when account verification is still in progress', () => {
    payoutSettingsMocks.isVerifying = true;
    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };
    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      payoutSettingsMocks.savePayoutSettings.mutate
    ).not.toHaveBeenCalled();
    expect(payoutSettingsMocks.alert).toHaveBeenCalledWith(
      'Error',
      'Please wait for account verification'
    );
  });

  it('blocks save when account verification reports an error', () => {
    payoutSettingsMocks.verifyError = 'Unable to verify account';
    payoutSettingsMocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };
    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      payoutSettingsMocks.savePayoutSettings.mutate
    ).not.toHaveBeenCalled();
    expect(payoutSettingsMocks.alert).toHaveBeenCalledWith(
      'Error',
      'Cannot save: Unable to verify account'
    );
  });
});
