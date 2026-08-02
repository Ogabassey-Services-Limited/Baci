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

  it('uses the shared page sheet in the bank picker modal', () => {
    render(<PayoutSettingsScreen />);
    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(screen.getByText('Select Bank')).toBeInTheDocument();
    expect(
      screen.getByLabelText('shared-bank-picker-sheet')
    ).toBeInTheDocument();
    expect(
      payoutSettingsMocks.pageSheetProps.some(
        (entry) =>
          entry.closeLabel === 'Close bank picker' &&
          entry.scrollEnabled === false &&
          entry.title === 'Select Bank'
      )
    ).toBe(true);
  });

  it('uses the shared page sheet to own the picker safe-area surface', () => {
    render(<PayoutSettingsScreen />);
    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(payoutSettingsMocks.pageSheetProps.at(-1)).toEqual(
      expect.objectContaining({
        closeLabel: 'Close bank picker',
        scrollEnabled: false,
        title: 'Select Bank',
      })
    );
  });
});
