import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangePickerCalendarPanel } from '@/components/ui/date-range-picker/DateRangePickerCalendarPanel';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#f8fafc',
      textMuted: '#94a3b8',
    },
  }),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { disabled?: boolean; selected?: boolean };
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-disabled={accessibilityState?.disabled ?? disabled}
      aria-label={accessibilityLabel}
      disabled={disabled}
      aria-pressed={accessibilityState?.selected}
      onClick={onPress}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('DateRangePickerCalendarPanel', () => {
  it('renders weekday headers in Sunday-to-Saturday order', () => {
    render(
      <DateRangePickerCalendarPanel
        onApply={vi.fn()}
        onSelectDay={vi.fn()}
        onViewNextMonth={vi.fn()}
        onViewPreviousMonth={vi.fn()}
        selection={{ end: null, start: null }}
        viewDate={new Date('2026-05-12T00:00:00.000Z')}
      />
    );

    expect(screen.getAllByText(/^[SMTWF]$/)).toHaveLength(7);
    expect(
      screen.getAllByText(/^[SMTWF]$/).map((weekday) => weekday.textContent)
    ).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('shows the selected range preview and applies the completed range', () => {
    const onApply = vi.fn();

    render(
      <DateRangePickerCalendarPanel
        onApply={onApply}
        onSelectDay={vi.fn()}
        onViewNextMonth={vi.fn()}
        onViewPreviousMonth={vi.fn()}
        selection={{
          end: new Date('2026-05-14T00:00:00.000Z'),
          start: new Date('2026-05-12T00:00:00.000Z'),
        }}
        viewDate={new Date('2026-05-12T00:00:00.000Z')}
      />
    );

    expect(screen.getByText('May 2026')).toBeInTheDocument();
    expect(screen.getByText('May 12 - May 14')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Range' }));

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('announces the apply button as disabled until a full range is selected', () => {
    const { rerender } = render(
      <DateRangePickerCalendarPanel
        onApply={vi.fn()}
        onSelectDay={vi.fn()}
        onViewNextMonth={vi.fn()}
        onViewPreviousMonth={vi.fn()}
        selection={{ end: null, start: new Date('2026-05-12T00:00:00.000Z') }}
        viewDate={new Date('2026-05-12T00:00:00.000Z')}
      />
    );

    expect(screen.getByRole('button', { name: 'Apply Range' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    rerender(
      <DateRangePickerCalendarPanel
        onApply={vi.fn()}
        onSelectDay={vi.fn()}
        onViewNextMonth={vi.fn()}
        onViewPreviousMonth={vi.fn()}
        selection={{
          end: new Date('2026-05-14T00:00:00.000Z'),
          start: new Date('2026-05-12T00:00:00.000Z'),
        }}
        viewDate={new Date('2026-05-12T00:00:00.000Z')}
      />
    );

    expect(screen.getByRole('button', { name: 'Apply Range' })).toHaveAttribute(
      'aria-disabled',
      'false'
    );
  });

  it('routes month navigation and day selection', () => {
    const onSelectDay = vi.fn();
    const onViewNextMonth = vi.fn();
    const onViewPreviousMonth = vi.fn();

    render(
      <DateRangePickerCalendarPanel
        onApply={vi.fn()}
        onSelectDay={onSelectDay}
        onViewNextMonth={onViewNextMonth}
        onViewPreviousMonth={onViewPreviousMonth}
        selection={{ end: null, start: null }}
        viewDate={new Date('2026-05-12T00:00:00.000Z')}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Tuesday, May 12th, 2026' })
    );

    expect(onViewPreviousMonth).toHaveBeenCalledTimes(1);
    expect(onViewNextMonth).toHaveBeenCalledTimes(1);
    expect(format(onSelectDay.mock.calls[0][0], 'MMM d')).toBe('May 12');
  });
});
