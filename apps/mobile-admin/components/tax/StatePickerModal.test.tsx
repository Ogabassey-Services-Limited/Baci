import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { StatePickerModal } from './StatePickerModal';

const mocks = vi.hoisted(() => ({
  listProps: {
    initialNumToRender: 0,
    maxToRenderPerBatch: 0,
    removeClippedSubviews: false,
    windowSize: 0,
  },
  platform: { OS: 'ios' as 'ios' | 'android' },
}));

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

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  FlatList: ({
    data,
    initialNumToRender,
    maxToRenderPerBatch,
    removeClippedSubviews,
    renderItem,
    windowSize,
  }: {
    data: Array<{ code: string; name: string }>;
    initialNumToRender?: number;
    maxToRenderPerBatch?: number;
    removeClippedSubviews?: boolean;
    renderItem: (item: { item: { code: string; name: string } }) => ReactNode;
    windowSize?: number;
  }) => {
    mocks.listProps.initialNumToRender = initialNumToRender ?? 0;
    mocks.listProps.maxToRenderPerBatch = maxToRenderPerBatch ?? 0;
    mocks.listProps.removeClippedSubviews = removeClippedSubviews ?? false;
    mocks.listProps.windowSize = windowSize ?? 0;
    return <div>{data.map((item) => renderItem({ item }))}</div>;
  },
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
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = LIGHT_COLORS;

describe('StatePickerModal', () => {
  afterEach(() => {
    mocks.platform.OS = 'ios';
  });

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

  it('applies shared list virtualization defaults', () => {
    render(
      <StatePickerModal
        colors={colors}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedStateCode="NG-LA"
        visible={true}
      />
    );

    expect(mocks.listProps.initialNumToRender).toBe(15);
    expect(mocks.listProps.maxToRenderPerBatch).toBe(10);
    expect(mocks.listProps.windowSize).toBe(5);
    expect(mocks.listProps.removeClippedSubviews).toBe(false);
  });

  it('applies Android clipping optimization through shared list props', () => {
    mocks.platform.OS = 'android';

    render(
      <StatePickerModal
        colors={colors}
        onClose={vi.fn()}
        onSelect={vi.fn()}
        selectedStateCode="NG-LA"
        visible={true}
      />
    );

    expect(mocks.listProps.initialNumToRender).toBe(15);
    expect(mocks.listProps.maxToRenderPerBatch).toBe(10);
    expect(mocks.listProps.windowSize).toBe(5);
    expect(mocks.listProps.removeClippedSubviews).toBe(true);
  });
});
