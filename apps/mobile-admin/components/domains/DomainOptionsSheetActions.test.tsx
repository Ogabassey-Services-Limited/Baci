import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DomainOptionsSheetActions from './DomainOptionsSheetActions';
import type { Domain } from './domain-types';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      errorLight: '#fee2e2',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#334155',
      warning: '#ca8a04',
      warningLight: '#fef9c3',
    },
  }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

const baseDomain: Domain = {
  created_at: '2026-05-01T00:00:00Z',
  domain: 'shop.usebaci.com',
  domain_type: 'custom',
  id: 'domain_1',
  is_primary: false,
  status: 'pending',
};

describe('DomainOptionsSheetActions', () => {
  it('shows visit, verify, and delete actions for a pending custom non-primary domain', () => {
    render(
      <DomainOptionsSheetActions domain={baseDomain} onAction={() => undefined} />
    );

    expect(screen.getByRole('button', { name: 'Visit Site' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Verify DNS Connection' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Domain' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Set as Primary Domain' })
    ).not.toBeInTheDocument();
  });

  it('shows visit and primary promotion actions for active non-primary domains', () => {
    render(
      <DomainOptionsSheetActions
        domain={{ ...baseDomain, status: 'active' }}
        onAction={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Visit Site' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Set as Primary Domain' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Domain' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify DNS Connection' })
    ).not.toBeInTheDocument();
  });

  it('hides destructive and primary actions for active primary domains', () => {
    render(
      <DomainOptionsSheetActions
        domain={{ ...baseDomain, is_primary: true, status: 'active' }}
        onAction={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Visit Site' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Set as Primary Domain' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Domain' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify DNS Connection' })
    ).not.toBeInTheDocument();
  });

  it('shows only visit for active primary subdomain entries', () => {
    render(
      <DomainOptionsSheetActions
        domain={{
          ...baseDomain,
          domain_type: 'subdomain',
          is_primary: true,
          status: 'active',
        }}
        onAction={() => undefined}
      />
    );

    expect(screen.getByRole('button', { name: 'Visit Site' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Verify DNS Connection' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Set as Primary Domain' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Delete Domain' })
    ).not.toBeInTheDocument();
  });

  it('invokes onAction with the expected action values for visible buttons', () => {
    const onAction = vi.fn();
    render(<DomainOptionsSheetActions domain={baseDomain} onAction={onAction} />);

    fireEvent.click(screen.getByRole('button', { name: 'Visit Site' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify DNS Connection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Domain' }));

    expect(onAction).toHaveBeenNthCalledWith(1, 'visit');
    expect(onAction).toHaveBeenNthCalledWith(2, 'verify');
    expect(onAction).toHaveBeenNthCalledWith(3, 'delete');
  });

  it('invokes set_primary only when it is visible', () => {
    const onAction = vi.fn();
    render(
      <DomainOptionsSheetActions
        domain={{ ...baseDomain, status: 'active' }}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Set as Primary Domain' }));
    expect(onAction).toHaveBeenCalledWith('set_primary');
  });
});
