import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StaffListSection } from './StaffListSection';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    ListEmptyComponent,
    renderItem,
    refreshControl,
  }: {
    data?: Array<{ id: string; [key: string]: unknown }>;
    ListEmptyComponent?: React.ReactNode;
    refreshControl?: React.ReactNode;
    renderItem: ({
      item,
    }: {
      item: { id: string; [key: string]: unknown };
    }) => React.ReactNode;
  }) =>
    data && data.length > 0 ? (
      <div>
        {refreshControl}
        {data.map((item) => (
          <div key={item.id}>{renderItem({ item })}</div>
        ))}
      </div>
    ) : (
      <div>
        {refreshControl}
        {ListEmptyComponent}
      </div>
    ),
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      type="button"
    >
      {children}
    </button>
  ),
  RefreshControl: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('StaffListSection', () => {
  it('renders staff rows and forwards member presses', () => {
    const onMemberPress = vi.fn();

    render(
      <StaffListSection
        colors={LIGHT_COLORS}
        isLoading={false}
        onInvitePress={vi.fn()}
        onMemberPress={onMemberPress}
        onRefresh={vi.fn()}
        refreshing={false}
        shadowStyle={SHADOWS.sm}
        staff={[
          {
            id: 'staff-1',
            merchant_id: 'merchant-1',
            user_id: 'user-1',
            email: 'ada@example.com',
            name: 'Ada',
            role: 'manager',
            status: 'active',
            created_at: '2026-04-13T10:00:00.000Z',
            invited_at: '2026-04-13T10:00:00.000Z',
            accepted_at: '2026-04-13T11:00:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('Store Manager')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Team member Ada' }));

    expect(onMemberPress).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'staff-1' })
    );
  });

  it('renders the empty state and forwards the invite action', () => {
    const onInvitePress = vi.fn();

    render(
      <StaffListSection
        colors={LIGHT_COLORS}
        isLoading={false}
        onInvitePress={onInvitePress}
        onMemberPress={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
        shadowStyle={SHADOWS.sm}
        staff={[]}
      />
    );

    expect(screen.getByText('No team members yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Invite team member' }));

    expect(onInvitePress).toHaveBeenCalledTimes(1);
  });

  it('renders a loading state before staff data is ready', () => {
    render(
      <StaffListSection
        colors={LIGHT_COLORS}
        isLoading={true}
        onInvitePress={vi.fn()}
        onMemberPress={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
        shadowStyle={SHADOWS.sm}
        staff={[]}
      />
    );

    expect(screen.getByText('Loading team members...')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Invite team member' })
    ).not.toBeInTheDocument();
  });

  it('shows a fallback label when a member email is missing', () => {
    render(
      <StaffListSection
        colors={LIGHT_COLORS}
        isLoading={false}
        onInvitePress={vi.fn()}
        onMemberPress={vi.fn()}
        onRefresh={vi.fn()}
        refreshing={false}
        shadowStyle={SHADOWS.sm}
        staff={[
          {
            id: 'staff-2',
            merchant_id: 'merchant-1',
            user_id: 'user-2',
            email: '',
            name: '',
            role: 'sales_rep',
            status: 'pending',
            created_at: '2026-04-13T10:00:00.000Z',
            invited_at: '2026-04-13T10:00:00.000Z',
            accepted_at: null,
          },
        ]}
      />
    );

    expect(screen.getByText('Unknown User')).toBeInTheDocument();
    expect(screen.getByText('Email unavailable')).toBeInTheDocument();
  });
});
