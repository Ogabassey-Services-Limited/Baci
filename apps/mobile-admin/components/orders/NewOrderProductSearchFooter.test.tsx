import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChangeEvent, ReactNode } from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderProductSearchFooter } from './NewOrderProductSearchFooter';

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
        onChangeText?: (value: string) => void;
        placeholder?: string;
        value?: string;
      }
    >(({ accessibilityLabel, onChangeText, placeholder, value }, ref) => (
      <input
        aria-label={accessibilityLabel ?? placeholder}
        data-gorhom-input="true"
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value)
        }
        ref={ref}
        value={value ?? ''}
      />
    )),
  };
});

vi.mock('react-native', () => {
  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

describe('NewOrderProductSearchFooter', () => {
  it('renders a keyboard-adjacent product search field and forwards changes', () => {
    const setProductSearch = vi.fn();

    render(
      <NewOrderProductSearchFooter
        colors={{
          primary: '#2563eb',
          text: '#f8fafc',
          textMuted: '#94a3b8',
        }}
        inputRef={createRef()}
        productSearch="phone"
        setProductSearch={setProductSearch}
      />
    );

    expect(
      screen.getByRole('textbox', { name: 'Search products' })
    ).toHaveAttribute('data-gorhom-input', 'true');

    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), {
      target: { value: 'laptop' },
    });

    expect(setProductSearch).toHaveBeenCalledWith('laptop');
  });
});
