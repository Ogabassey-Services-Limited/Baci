import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderReportDateMenu } from '@/components/ui/order-report-modal/OrderReportDateMenu';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      primary: '#2563eb',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
    },
    shadows: {
      md: {},
    },
  }),
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: (event: { stopPropagation: () => void }) => void;
  }) => (
    <div
      aria-label={accessibilityLabel}
      onClick={(event) =>
        onPress?.({ stopPropagation: () => event.stopPropagation() })
      }
      onKeyDown={() => undefined}
      role="button"
      tabIndex={0}
    >
      {children}
    </div>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('OrderReportDateMenu', () => {
  it('renders the active date label and toggles the preset menu', () => {
    const onToggleDropdown = vi.fn();
    const onParentPress = vi.fn();

    render(
      <div
        onClick={onParentPress}
        onKeyDown={() => undefined}
        role="button"
        tabIndex={0}
      >
        <OrderReportDateMenu
          dateRangeLabel="Last 7 Days"
          onCustomRangeSelect={vi.fn()}
          onPresetSelect={vi.fn()}
          onToggleDropdown={onToggleDropdown}
          showDropdown={false}
        />
      </div>
    );

    expect(screen.getByText('Summary for:')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change date range' }));

    expect(onToggleDropdown).toHaveBeenCalledTimes(1);
    expect(onParentPress).not.toHaveBeenCalled();
  });

  it('keeps the date label visible when date changes are disabled', () => {
    render(
      <OrderReportDateMenu dateRangeLabel="This Month" showDropdown={false} />
    );

    expect(screen.getByText('Summary for:')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Change date range' })
    ).not.toBeInTheDocument();
  });

  it('routes preset and custom range selections when the menu is open', () => {
    const onPresetSelect = vi.fn();
    const onCustomRangeSelect = vi.fn();

    render(
      <OrderReportDateMenu
        dateRangeLabel="Last 30 Days"
        onCustomRangeSelect={onCustomRangeSelect}
        onPresetSelect={onPresetSelect}
        onToggleDropdown={vi.fn()}
        showDropdown={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Last 30 Days' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Select custom date range' })
    );

    expect(onPresetSelect).toHaveBeenCalledWith('Last 30 Days');
    expect(onCustomRangeSelect).toHaveBeenCalledTimes(1);
  });
});
