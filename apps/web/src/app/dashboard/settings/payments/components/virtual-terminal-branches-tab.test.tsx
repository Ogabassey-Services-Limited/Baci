import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '@/components/ui/tabs';
import { VirtualTerminalBranchesTab } from './virtual-terminal-branches-tab';

describe('VirtualTerminalBranchesTab', () => {
  it('renders the selected merchant empty state and create action', () => {
    render(
      <Tabs defaultValue="branches">
        <VirtualTerminalBranchesTab
          branchDialogOpen={false}
          branches={[]}
          creating={false}
          handleCreateBranch={vi.fn()}
          newBranch={{ name: '', address: '', city: '' }}
          setBranchDialogOpen={vi.fn()}
          setNewBranch={vi.fn()}
        />
      </Tabs>
    );

    expect(screen.getByText('No Branches Yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new branch/i })
    ).toBeInTheDocument();
  });
});
