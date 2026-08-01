import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_VTU_SETTINGS } from './vtu-settings-types';

const useVtuSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('./use-vtu-settings', () => ({
  useVtuSettings: useVtuSettingsMock,
}));

import { VtuSettingsContent } from './vtu-settings-content';

const baseHookState = {
  addAmount: vi.fn(),
  loadError: null,
  loading: false,
  newAmount: '',
  removeAmount: vi.fn(),
  retryLoad: vi.fn(),
  save: vi.fn(),
  saving: false,
  setNewAmount: vi.fn(),
  setSettings: vi.fn(),
  settings: DEFAULT_VTU_SETTINGS,
};

describe('VtuSettingsContent', () => {
  it('hides merchant controls while its settings load', () => {
    useVtuSettingsMock.mockReturnValue({ ...baseHookState, loading: true });

    render(<VtuSettingsContent merchantId="merchant-a" toast={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: /save settings/i })
    ).not.toBeInTheDocument();
  });

  it('renders the save action after the selected merchant settings load', () => {
    useVtuSettingsMock.mockReturnValue(baseHookState);

    render(<VtuSettingsContent merchantId="merchant-a" toast={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: /save settings/i })
    ).toBeInTheDocument();
  });
});
