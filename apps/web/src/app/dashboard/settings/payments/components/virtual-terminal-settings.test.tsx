import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const useVirtualTerminalSettingsMock = vi.hoisted(() => vi.fn());

vi.mock('./use-virtual-terminal-settings', () => ({
  useVirtualTerminalSettings: useVirtualTerminalSettingsMock,
}));
vi.mock('./virtual-terminal-accounts-tab', () => ({
  VirtualTerminalAccountsTab: () => null,
}));
vi.mock('./virtual-terminal-branches-tab', () => ({
  VirtualTerminalBranchesTab: () => null,
}));

import { VirtualTerminalSettings } from './virtual-terminal-settings';

describe('VirtualTerminalSettings', () => {
  it('announces virtual-terminal loading for the displayed merchant', () => {
    useVirtualTerminalSettingsMock.mockReturnValue({ loading: true });

    render(
      <VirtualTerminalSettings
        businessName="Ada's Store"
        merchantId="merchant-123"
      />
    );

    expect(useVirtualTerminalSettingsMock).toHaveBeenCalledWith({
      businessName: "Ada's Store",
      merchantId: 'merchant-123',
    });
    expect(
      screen.getByRole('status', { name: /loading payment accounts/i })
    ).toBeInTheDocument();
  });

  it('uses a semantic heading when the payment accounts are loaded', () => {
    useVirtualTerminalSettingsMock.mockReturnValue({
      accounts: [],
      branches: [],
      branchDialogOpen: false,
      copyToClipboard: vi.fn(),
      creating: false,
      dialogOpen: false,
      handleCreateAccount: vi.fn(),
      handleCreateBranch: vi.fn(),
      loading: false,
      newAccount: { branchId: '', name: '', staffId: '' },
      newBranch: { address: '', city: '', name: '' },
      setBranchDialogOpen: vi.fn(),
      setDialogOpen: vi.fn(),
      setNewAccount: vi.fn(),
      setNewBranch: vi.fn(),
    });

    render(<VirtualTerminalSettings merchantId="merchant-123" />);

    expect(
      screen.getByRole('heading', { name: /payment accounts/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /staff accounts/i })
    ).toBeInTheDocument();
  });
});
