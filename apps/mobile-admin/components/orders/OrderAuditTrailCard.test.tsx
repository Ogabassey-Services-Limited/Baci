import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { OrderAuditEvent } from '@/hooks/orders/useOrderAuditEvents';
import { OrderAuditTrailCard } from './OrderAuditTrailCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textSecondary: '#64748b',
};

function auditEvent(overrides: Partial<OrderAuditEvent>): OrderAuditEvent {
  return {
    actor_user_id: 'user-1',
    change_category: 'financial',
    changed_fields: ['items', 'total'],
    created_at: '2026-06-26T12:00:00.000Z',
    id: 'audit-1',
    ...overrides,
  };
}

describe('OrderAuditTrailCard', () => {
  it('renders latest audit events with readable field labels', () => {
    render(
      <OrderAuditTrailCard
        colors={colors}
        events={[auditEvent({})]}
        formatDate={() => 'Jun 26, 2026'}
        isError={false}
        isLoading={false}
      />
    );

    expect(screen.getByText('Audit trail')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getByText('Items, Total')).toBeInTheDocument();
    expect(screen.getByText('Jun 26, 2026')).toBeInTheDocument();
  });

  it('does not render when there are no audit events', () => {
    render(
      <OrderAuditTrailCard
        colors={colors}
        events={[]}
        formatDate={() => 'Jun 26, 2026'}
        isError={false}
        isLoading={false}
      />
    );

    expect(screen.queryByText('Audit trail')).not.toBeInTheDocument();
    expect(screen.queryByText('Order details')).not.toBeInTheDocument();
  });

  it('renders a loading state while audit events load', () => {
    render(
      <OrderAuditTrailCard
        colors={colors}
        events={[]}
        formatDate={() => 'Jun 26, 2026'}
        isError={false}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading audit trail...')).toBeInTheDocument();
  });

  it('renders an error state when audit events cannot be loaded', () => {
    render(
      <OrderAuditTrailCard
        colors={colors}
        events={[]}
        formatDate={() => 'Jun 26, 2026'}
        isError={true}
        isLoading={false}
      />
    );

    expect(
      screen.getByText('Audit trail could not be loaded.')
    ).toBeInTheDocument();
  });
});
