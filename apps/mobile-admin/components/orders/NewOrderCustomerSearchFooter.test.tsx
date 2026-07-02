import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChangeEvent, ReactNode } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderCustomerSearchFooter } from './NewOrderCustomerSearchFooter';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: true }),
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    BottomSheetTextInput: React.forwardRef<
      HTMLInputElement,
      {
        accessibilityLabel?: string;
        autoFocus?: boolean;
        onChangeText?: (value: string) => void;
        placeholder?: string;
        value?: string;
      }
    >(
      (
        { accessibilityLabel, autoFocus, onChangeText, placeholder, value },
        ref
      ) => (
        <input
          aria-label={accessibilityLabel ?? placeholder}
          data-autofocus={String(Boolean(autoFocus))}
          data-gorhom-input="true"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChangeText?.(event.target.value)
          }
          ref={ref}
          value={value ?? ''}
        />
      )
    ),
  };
});

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

describe('NewOrderCustomerSearchFooter', () => {
  it('renders a keyboard-adjacent customer search field and forwards changes', () => {
    const setCustomerSearch = vi.fn();

    render(
      <NewOrderCustomerSearchFooter
        colors={{
          primary: '#2563eb',
          text: '#f8fafc',
          textMuted: '#94a3b8',
        }}
        inputRef={createRef()}
        autoFocus={true}
        customerSearch="ada"
        setCustomerSearch={setCustomerSearch}
      />
    );

    expect(screen.getByTestId('customer-search-footer')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Search customers' })
    ).toHaveAttribute('data-autofocus', 'true');
    expect(
      screen.getByRole('textbox', { name: 'Search customers' })
    ).toHaveAttribute('data-gorhom-input', 'true');

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search customers' }),
      {
        target: { value: 'victor' },
      }
    );

    expect(setCustomerSearch).toHaveBeenCalledWith('victor');
  });
});
