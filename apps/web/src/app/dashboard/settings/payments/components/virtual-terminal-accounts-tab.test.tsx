import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { VirtualTerminalAccountsTab } from './virtual-terminal-accounts-tab';

describe('VirtualTerminalAccountsTab', () => {
  it('renders the selected merchant empty state and create action', () => {
    render(
      <Tabs defaultValue="accounts">
        <VirtualTerminalAccountsTab
          accounts={[]}
          branches={[]}
          copyToClipboard={vi.fn()}
          creating={false}
          dialogOpen={false}
          handleCreateAccount={vi.fn()}
          newAccount={{ name: '', staffId: '', branchId: '' }}
          setDialogOpen={vi.fn()}
          setNewAccount={vi.fn()}
          staffMembers={[]}
        />
      </Tabs>
    );

    expect(screen.getByText('No Staff Accounts Yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new staff account/i })
    ).toBeInTheDocument();
  });
});
