import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppDatePickerField } from './AppDatePickerField';

const mocks = vi.hoisted(() => ({
  datePickerOnChange: null as
    | ((event: { type?: string }, selectedDate?: Date) => void)
    | null,
  platform: { OS: 'ios' as 'ios' | 'android' },
}));

vi.mock('@react-native-community/datetimepicker', () => ({
  default: ({
    onChange,
  }: {
    onChange: (event: { type?: string }, selectedDate?: Date) => void;
  }) => {
    mocks.datePickerOnChange = onChange;
    return <button type="button">Mock date picker</button>;
  },
}));

vi.mock('react-native', () => ({
  Platform: mocks.platform,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

afterEach(() => {
  mocks.platform.OS = 'ios';
  mocks.datePickerOnChange = null;
});

describe('AppDatePickerField', () => {
  it('keeps iOS picker changes pending until confirm is pressed', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <AppDatePickerField
        onClose={onClose}
        onConfirm={onConfirm}
        value={new Date('2024-01-02T00:00:00.000Z')}
      />
    );

    act(() => {
      mocks.datePickerOnChange?.({}, new Date('2024-02-03T00:00:00.000Z'));
    });
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm date selection' }));

    expect(onConfirm).toHaveBeenCalledWith(new Date('2024-02-03T00:00:00.000Z'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms immediately and closes on Android selection', () => {
    mocks.platform.OS = 'android';
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <AppDatePickerField
        onClose={onClose}
        onConfirm={onConfirm}
        value={new Date('2024-01-02T00:00:00.000Z')}
      />
    );

    mocks.datePickerOnChange?.({ type: 'set' }, new Date('2024-03-04T00:00:00.000Z'));

    expect(onConfirm).toHaveBeenCalledWith(new Date('2024-03-04T00:00:00.000Z'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes without confirming on Android dismiss', () => {
    mocks.platform.OS = 'android';
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <AppDatePickerField
        onClose={onClose}
        onConfirm={onConfirm}
        value={new Date('2024-01-02T00:00:00.000Z')}
      />
    );

    mocks.datePickerOnChange?.({ type: 'dismissed' });

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
