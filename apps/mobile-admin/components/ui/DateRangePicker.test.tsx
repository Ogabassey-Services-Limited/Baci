import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DateRangePicker from '@/components/ui/DateRangePicker';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#f8fafc',
      textMuted: '#94a3b8',
    },
    shadows: {
      lg: {},
    },
  }),
}));

vi.mock('react-native', () => ({
  Dimensions: {
    get: () => ({ height: 800, width: 400 }),
  },
  Modal: ({ children, visible }: { children?: ReactNode; visible: boolean }) =>
    visible ? (
      <section aria-label="date-range-picker">{children}</section>
    ) : null,
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('DateRangePicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the preset mode and highlights the active preset filter', () => {
    render(
      <DateRangePicker
        currentFilter="Last 7 Days"
        onClose={vi.fn()}
        onSelect={vi.fn()}
        visible={true}
      />
    );

    expect(screen.getByLabelText('date-range-picker')).toBeInTheDocument();
    expect(screen.getByText('Select Date Range')).toBeInTheDocument();
    expect(screen.getByText('Presets')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('checkmark-circle')).toBeInTheDocument();
  });

  it('selects a preset and closes the picker', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <DateRangePicker
        currentFilter={null}
        onClose={onClose}
        onSelect={onSelect}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Today' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('Today');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('clears the current filter from presets mode', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <DateRangePicker
        currentFilter="This Month"
        onClose={onClose}
        onSelect={onSelect}
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(null);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('initializes custom mode from an existing range and applies a newly selected range', async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <DateRangePicker
        currentFilter={{
          end: new Date('2026-05-12T00:00:00.000Z'),
          start: new Date('2026-05-10T00:00:00.000Z'),
        }}
        onClose={onClose}
        onSelect={onSelect}
        visible={true}
      />
    );

    expect(screen.getByText('May 10 - May 12')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Thursday, May 14th, 2026',
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Tuesday, May 12th, 2026',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Apply Range' }));

    await waitFor(() => {
      const firstCall = onSelect.mock.calls[0]?.[0];
      expect(firstCall).toMatchObject({
        end: expect.any(Date),
        start: expect.any(Date),
      });
      expect(format(firstCall.start, 'MMM d')).toBe('May 12');
      expect(format(firstCall.end, 'MMM d')).toBe('May 14');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  }, 15_000);
});
