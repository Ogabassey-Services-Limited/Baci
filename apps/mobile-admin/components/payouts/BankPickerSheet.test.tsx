import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BankPickerSheet } from './BankPickerSheet';

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    title,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    onClose: () => void;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="bank-page-sheet">
        <button
          aria-label={closeLabel ?? 'Close sheet'}
          onClick={onClose}
          type="button"
        >
          close
        </button>
        <h1>{title}</h1>
        {children}
      </section>
    ) : null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#d1d5db',
      card: '#f8fafc',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#0f172a',
      textMuted: '#94a3b8',
    },
  }),
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <div>loading</div>,
  FlatList: ({
    data,
    ListEmptyComponent,
    renderItem,
  }: {
    data: Array<{ code: string; name: string }>;
    ListEmptyComponent?: ReactNode;
    renderItem: (item: { item: { code: string; name: string } }) => ReactNode;
  }) => (
    <div>
      {data.length === 0
        ? (ListEmptyComponent ?? null)
        : data.map((item) => renderItem({ item }))}
    </div>
  ),
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    onChangeText,
    value,
  }: {
    accessibilityLabel?: string;
    onChangeText?: (text: string) => void;
    value?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChangeText?.(event.target.value)}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('BankPickerSheet', () => {
  it('renders through the shared page-sheet shell and routes actions', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    const onSearchChange = vi.fn();

    render(
      <BankPickerSheet
        banks={[
          { active: true, code: '058', id: 1, name: 'GTBank', slug: 'gtbank' },
          {
            active: true,
            code: '044',
            id: 2,
            name: 'Access Bank',
            slug: 'access-bank',
          },
        ]}
        isLoading={false}
        onClose={onClose}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
        searchTerm=""
        selectedBankCode="058"
        visible={true}
      />
    );

    expect(screen.getByLabelText('bank-page-sheet')).toBeInTheDocument();
    expect(screen.getByText('Select Bank')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close bank picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Access Bank' }));
    fireEvent.change(screen.getByLabelText('Search banks'), {
      target: { value: 'access' },
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      active: true,
      code: '044',
      id: 2,
      name: 'Access Bank',
      slug: 'access-bank',
    });
    expect(onSearchChange).toHaveBeenCalledWith('access');
  });

  it('does not render when hidden', () => {
    render(
      <BankPickerSheet
        banks={[]}
        isLoading={false}
        onClose={vi.fn()}
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        searchTerm=""
        selectedBankCode={null}
        visible={false}
      />
    );

    expect(screen.queryByLabelText('bank-page-sheet')).not.toBeInTheDocument();
  });

  it('shows loading and empty states for the picker body', () => {
    const { rerender } = render(
      <BankPickerSheet
        banks={[]}
        isLoading={true}
        onClose={vi.fn()}
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        searchTerm=""
        selectedBankCode={null}
        visible={true}
      />
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText('No banks found')).not.toBeInTheDocument();

    rerender(
      <BankPickerSheet
        banks={[]}
        isLoading={false}
        onClose={vi.fn()}
        onSearchChange={vi.fn()}
        onSelect={vi.fn()}
        searchTerm=""
        selectedBankCode={null}
        visible={true}
      />
    );

    expect(screen.getByText('No banks found')).toBeInTheDocument();
  });
});
