import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangePickerPresetPanel } from '@/components/ui/date-range-picker/DateRangePickerPresetPanel';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
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
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <div
      aria-label={accessibilityLabel}
      onClick={onPress}
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

describe('DateRangePickerPresetPanel', () => {
  it('renders presets and marks the active preset', () => {
    render(
      <DateRangePickerPresetPanel
        activePreset="This Month"
        onClear={vi.fn()}
        onSelectPreset={vi.fn()}
      />
    );

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('This Month')).toBeInTheDocument();
    expect(screen.getByText('checkmark-circle')).toBeInTheDocument();
  });

  it('routes preset and clear actions', () => {
    const onClear = vi.fn();
    const onSelectPreset = vi.fn();

    render(
      <DateRangePickerPresetPanel
        activePreset={null}
        onClear={onClear}
        onSelectPreset={onSelectPreset}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear date filter' }));

    expect(onSelectPreset).toHaveBeenCalledWith('Last 30 Days');
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
