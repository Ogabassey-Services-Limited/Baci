import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PayoutBankPickerModal } from './PayoutBankPickerModal';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => <span>icon</span>,
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({ children }: { children?: ReactNode }) => (
    <section aria-label="bank-modal-keyboard">{children}</section>
  ),
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    scrollEnabled,
    title,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    onClose: () => void;
    scrollEnabled?: boolean;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <section
        aria-label="shared-bank-picker-sheet"
        data-scroll-enabled={String(scrollEnabled)}
      >
        <button aria-label={closeLabel} onClick={onClose} type="button">
          close
        </button>
        <h1>{title}</h1>
        {children}
      </section>
    ) : null,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ code: string; name: string }>;
    renderItem: (props: { item: { code: string; name: string } }) => ReactNode;
  }) => (
    <div>
      {data.map((item) => (
        <div key={item.code}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) => (visible ? <div>{children}</div> : null),
  Platform: { OS: 'ios' },
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
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    onChangeText,
    placeholder,
    value,
  }: {
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  background: '#0b0b1a',
  border: '#e2e8f0',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#64748b',
};

describe('PayoutBankPickerModal', () => {
  it('uses the shared page sheet for the dark safe-area picker shell', () => {
    render(
      <PayoutBankPickerModal
        banks={[]}
        colors={colors}
        isLoading={false}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedBank={null}
        visible
      />
    );

    expect(screen.getByLabelText('shared-bank-picker-sheet')).toHaveAttribute(
      'data-scroll-enabled',
      'false'
    );
    expect(
      screen.getByRole('button', { name: 'Close bank picker' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Select Bank' })
    ).toBeInTheDocument();
  });

  it('filters banks and closes after selecting the filtered bank', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <PayoutBankPickerModal
        banks={[
          { active: true, code: '001', id: 1, name: 'GTBank', slug: 'gtbank' },
          {
            active: true,
            code: '002',
            id: 2,
            name: 'Access Bank',
            slug: 'access',
          },
        ]}
        colors={colors}
        isLoading={false}
        onClose={onClose}
        onSelect={onSelect}
        selectedBank={null}
        visible
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search banks...'), {
      target: { value: 'access' },
    });

    expect(screen.queryByText('GTBank')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Access Bank'));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ code: '002', name: 'Access Bank' })
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
