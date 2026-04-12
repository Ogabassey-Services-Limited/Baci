import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { StatePickerModal } from './StatePickerModal';

vi.mock('@baci/shared', () => ({
  NIGERIAN_STATES: [
    { code: 'NG-LA', name: 'Lagos' },
    { code: 'NG-AB', name: 'Abia' },
  ],
}));

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
      <section aria-label="state-page-sheet">
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

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', async () => ({
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ code: string; name: string }>;
    renderItem: (item: { item: { code: string; name: string } }) => ReactNode;
  }) => <div>{data.map((item) => renderItem({ item }))}</div>,
  Platform: {
    OS: 'ios',
  },
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
  Platform: {
    OS: 'ios',
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = LIGHT_COLORS;

describe('StatePickerModal', () => {
  it('renders through the shared page-sheet shell', () => {
    render(
      <StatePickerModal
        colors={colors}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedStateCode="NG-LA"
        visible={true}
      />
    );

    expect(screen.getByLabelText('state-page-sheet')).toBeInTheDocument();
    expect(screen.getByText('Select State')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lagos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abia' })).toBeInTheDocument();
  });

  it('routes close and select actions', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();

    render(
      <StatePickerModal
        colors={colors}
        onClose={onClose}
        onSelect={onSelect}
        selectedStateCode="NG-LA"
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close state picker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abia' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('NG-AB');
  });

  it('does not render when hidden', () => {
    render(
      <StatePickerModal
        colors={colors}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedStateCode="NG-LA"
        visible={false}
      />
    );

    expect(screen.queryByLabelText('state-page-sheet')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Lagos' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Abia' })
    ).not.toBeInTheDocument();
  });
});
