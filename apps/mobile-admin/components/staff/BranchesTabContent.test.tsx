import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { BranchesTabContent } from './BranchesTabContent';
import type { Branch } from './types';

const mocks = vi.hoisted(() => ({
  branchCard: vi.fn(),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/staff/BranchCard', () => ({
  BranchCard: (props: {
    branch: Branch;
    canDeactivate: boolean;
    onDeactivate: (branchId: string) => void;
    onEdit: (branchId: string) => void;
  }) => {
    mocks.branchCard(props);
    return <div>{props.branch.name}</div>;
  },
}));

const branch = {
  active: true,
  address: null,
  city: 'Lagos',
  id: 'branch-1',
  is_default: true,
  name: 'Lagos main',
} satisfies Branch;

describe('BranchesTabContent', () => {
  it('renders the empty branches state', () => {
    render(
      <BranchesTabContent
        activeBranches={[]}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        onDeactivate={vi.fn()}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('No Branches Yet')).toBeInTheDocument();
    expect(
      screen.getByText('Add store locations to organize staff accounts.')
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-icon="business-outline"]')
    ).toBeTruthy();
  });

  it('passes active branches and deactivation state to BranchCard', () => {
    const onDeactivate = vi.fn();
    const onEdit = vi.fn();

    render(
      <BranchesTabContent
        activeBranches={[branch, { ...branch, id: 'branch-2', name: 'Abuja' }]}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        onDeactivate={onDeactivate}
        onEdit={onEdit}
      />
    );

    expect(screen.getByText('Lagos main')).toBeInTheDocument();
    expect(screen.getByText('Abuja')).toBeInTheDocument();
    expect(mocks.branchCard).toHaveBeenCalledWith(
      expect.objectContaining({
        branch,
        canDeactivate: true,
        onDeactivate,
        onEdit,
      })
    );
  });

  it('disables branch deactivation when only one active branch exists', () => {
    const onDeactivate = vi.fn();
    const onEdit = vi.fn();

    render(
      <BranchesTabContent
        activeBranches={[branch]}
        colors={LIGHT_COLORS}
        shadows={SHADOWS}
        onDeactivate={onDeactivate}
        onEdit={onEdit}
      />
    );

    expect(mocks.branchCard).toHaveBeenCalledWith(
      expect.objectContaining({
        branch,
        canDeactivate: false,
        onDeactivate,
        onEdit,
      })
    );
  });
});
