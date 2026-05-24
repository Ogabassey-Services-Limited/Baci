import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useTheme } from '@/hooks/useTheme';
import DateOfBirthPicker from './DateOfBirthPicker';

const mocks = vi.hoisted(() => ({
  appDatePickerProps: {
    onConfirm: ((_date: Date) => undefined) as (date: Date) => void,
  },
}));

vi.mock('@/components/ui/AppDatePickerField', () => ({
  AppDatePickerField: ({ onConfirm }: { onConfirm: (date: Date) => void }) => {
    mocks.appDatePickerProps.onConfirm = onConfirm;
    return <div aria-label="dob-picker-field">picker</div>;
  },
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => <span>icon</span>,

  default: () => <span>icon</span>,
  __esModule: true,
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
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
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

describe('DateOfBirthPicker', () => {
  const colors = {
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textMuted: '#64748b',
  } as ReturnType<typeof useTheme>['colors'];

  it('shows placeholder text before a date is selected', () => {
    render(<DateOfBirthPicker colors={colors} onChange={vi.fn()} value="" />);

    expect(screen.getByText('Select date of birth')).toBeInTheDocument();
  });

  it('normalizes confirmed dates to YYYY-MM-DD', () => {
    const onChange = vi.fn();

    render(<DateOfBirthPicker colors={colors} onChange={onChange} value="" />);

    fireEvent.click(screen.getByLabelText('Select date of birth'));
    mocks.appDatePickerProps.onConfirm(new Date('2000-01-15T00:00:00.000Z'));

    expect(onChange).toHaveBeenCalledWith('2000-01-15');
  });
});
