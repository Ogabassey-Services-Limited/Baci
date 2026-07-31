import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadPayoutSettingsScreen,
  payoutSettingsMocks,
  resetPayoutSettingsMocks,
} from '../../__tests__/admin/payout-settings.test-support';

describe('PayoutSettingsScreen bank picker', () => {
  let PayoutSettingsScreen: ComponentType;

  beforeEach(async () => {
    resetPayoutSettingsMocks();
    PayoutSettingsScreen = await loadPayoutSettingsScreen();
  });

  it('uses the shared keyboard container in the bank picker modal', () => {
    render(<PayoutSettingsScreen />);
    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(screen.getByText('Select Bank')).toBeInTheDocument();
    expect(screen.getByLabelText('bank-modal-keyboard')).toBeInTheDocument();
    expect(
      payoutSettingsMocks.keyboardContainerProps.some(
        (entry) => entry.align === 'start' && entry.scrollEnabled === false
      )
    ).toBe(true);
  });

  it('paints the bank picker keyboard container through the bottom safe area', () => {
    render(<PayoutSettingsScreen />);
    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(payoutSettingsMocks.keyboardContainerProps.at(-1)?.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#0b0b1a' }),
      ])
    );
  });
});
