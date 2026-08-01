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
  dismissKeyboard: vi.fn(),
}));

vi.mock('@/components/ui/AppDatePickerField', async () => {
  const { Text } = await import('react-native');

  return {
    AppDatePickerField: ({
      onConfirm,
    }: {
      onConfirm: (date: Date) => void;
    }) => {
      mocks.appDatePickerProps.onConfirm = onConfirm;
      return (
        <div>
          <Text>picker</Text>
        </div>
      );
    },
  };
});

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const { Text } = await import('react-native');

  return {
    Ionicons: () => <Text>icon</Text>,

    default: () => <Text>icon</Text>,
    __esModule: true,
  };
});

vi.mock('react-native', () => ({
  Keyboard: { dismiss: mocks.dismissKeyboard },
  StatusBar: () => null,
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

  it('dismisses the text keyboard before opening the date picker', () => {
    render(<DateOfBirthPicker colors={colors} onChange={vi.fn()} value="" />);

    fireEvent.click(screen.getByLabelText('Select date of birth'));

    expect(mocks.dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(screen.getByText('picker')).toBeInTheDocument();
  });

  it('normalizes confirmed dates to YYYY-MM-DD', () => {
    const onChange = vi.fn();

    render(<DateOfBirthPicker colors={colors} onChange={onChange} value="" />);

    fireEvent.click(screen.getByLabelText('Select date of birth'));
    mocks.appDatePickerProps.onConfirm(new Date('2000-01-15T00:00:00.000Z'));

    expect(onChange).toHaveBeenCalledWith('2000-01-15');
  });
});
