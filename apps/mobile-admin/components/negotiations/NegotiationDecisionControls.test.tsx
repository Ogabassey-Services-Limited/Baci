import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { NegotiationCardColors } from './NegotiationCard';
import { NegotiationDecisionControls } from './NegotiationDecisionControls';

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () => React.createElement('span', null, 'Loading'),
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { disabled, onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors: NegotiationCardColors = {
  backgroundLight: '#0f172a',
  border: '#334155',
  card: '#111827',
  error: '#ef4444',
  errorLight: '#fee2e2',
  primary: '#60a5fa',
  success: '#22c55e',
  successLight: '#dcfce7',
  text: '#f8fafc',
  textOnPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
};

describe('NegotiationDecisionControls', () => {
  it('forwards pending accept and reject actions', () => {
    const onAction = vi.fn();

    render(
      <NegotiationDecisionControls
        actionLoading={false}
        actionsDisabled={false}
        colors={colors}
        itemId="negotiation-1"
        onAction={onAction}
        status="pending"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Accept Offer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(onAction).toHaveBeenCalledWith('negotiation-1', 'accepted');
    expect(onAction).toHaveBeenCalledWith('negotiation-1', 'rejected');
  });

  it('renders completed statuses without action buttons', () => {
    render(
      <NegotiationDecisionControls
        actionLoading={false}
        actionsDisabled={false}
        colors={colors}
        itemId="negotiation-1"
        onAction={vi.fn()}
        status="accepted"
      />
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByText('Accept Offer')).not.toBeInTheDocument();
  });

  it.each([
    ['rejected', 'Rejected'],
    ['countered', 'Countered'],
  ] as const)('renders the %s outcome without actions', (status, label) => {
    render(
      <NegotiationDecisionControls
        actionLoading={false}
        actionsDisabled={false}
        colors={colors}
        itemId="negotiation-1"
        onAction={vi.fn()}
        status={status}
      />
    );

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Offer' })).toBeNull();
  });

  it('disables pending actions and shows loading indicators while submitting', () => {
    render(
      <NegotiationDecisionControls
        actionLoading={true}
        actionsDisabled={true}
        colors={colors}
        itemId="negotiation-1"
        onAction={vi.fn()}
        status="pending"
      />
    );

    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(
      screen
        .getAllByRole('button')
        .every((button) => button.hasAttribute('disabled'))
    ).toBe(true);
    expect(screen.getAllByText('Loading')).toHaveLength(2);
  });
});
