import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderProductPickerSheetFrame } from './NewOrderProductPickerSheetFrame';

const bottomSheetState = vi.hoisted(() => ({
  backdropComponents: [] as unknown[],
  footerComponents: [] as unknown[],
  snapToIndex: vi.fn(),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 8, right: 0, bottom: 12, left: 0 }),
}));

vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) => <div data-testid={testID}>{children}</div>,
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    __esModule: true,
    default: React.forwardRef(
      (
        {
          index,
          android_keyboardInputMode,
          backdropComponent: BackdropComponent,
          children,
          enableContentPanningGesture,
          enablePanDownToClose,
          footerComponent: FooterComponent,
          keyboardBehavior,
          keyboardBlurBehavior,
          onClose,
          snapPoints,
        }: {
          index?: number;
          android_keyboardInputMode?: string;
          backdropComponent?: (props: Record<string, unknown>) => ReactNode;
          children?: ReactNode;
          enableContentPanningGesture?: boolean;
          enablePanDownToClose?: boolean;
          footerComponent?: (props: Record<string, unknown>) => ReactNode;
          keyboardBehavior?: string;
          keyboardBlurBehavior?: string;
          onClose?: () => void;
          snapPoints?: string[];
        },
        ref: React.Ref<{ snapToIndex: (index: number) => void }>
      ) => {
        React.useImperativeHandle(ref, () => ({
          snapToIndex: bottomSheetState.snapToIndex,
        }));
        bottomSheetState.backdropComponents.push(BackdropComponent);
        bottomSheetState.footerComponents.push(FooterComponent);

        return (
          <section
            aria-label="gorhom-bottom-sheet"
            data-android-keyboard-input-mode={android_keyboardInputMode}
            data-keyboard-behavior={keyboardBehavior}
            data-keyboard-blur-behavior={keyboardBlurBehavior}
            data-content-panning={String(enableContentPanningGesture)}
            data-index={index}
            data-pan-down-close={String(Boolean(enablePanDownToClose))}
            data-snap-points={snapPoints?.join(',')}
          >
            {BackdropComponent?.({})}
            {children}
            {FooterComponent?.({})}
            <button
              aria-label="Pan sheet down"
              onClick={onClose}
              type="button"
            />
          </section>
        );
      }
    ),
    BottomSheetBackdrop: ({
      onPress,
      pressBehavior,
    }: {
      onPress?: () => void;
      pressBehavior?: string;
    }) => (
      <button
        aria-label="Close product sheet backdrop"
        data-press-behavior={pressBehavior}
        onClick={onPress}
        type="button"
      />
    ),
    BottomSheetFooter: ({
      bottomInset,
      children,
    }: {
      bottomInset?: number;
      children?: ReactNode;
    }) => (
      <footer data-bottom-inset={bottomInset} data-testid="gorhom-sheet-footer">
        {children}
      </footer>
    ),
    BottomSheetView: ({
      children,
      testID,
    }: {
      children?: ReactNode;
      testID?: string;
    }) => <div data-testid={testID}>{children}</div>,
  };
});

vi.mock('react-native', () => ({
  Modal: ({
    children,
    visible,
  }: {
    children?: ReactNode;
    visible?: boolean;
  }) =>
    visible ? (
      <section aria-label="product-picker-modal">{children}</section>
    ) : null,
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
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children, testID }: { children?: ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

const colors = {
  background: '#050713',
  border: '#26283a',
  card: '#18192a',
  primary: '#3b82f6',
  text: '#ffffff',
  textMuted: '#94a3b8',
};

describe('NewOrderProductPickerSheetFrame', () => {
  beforeEach(() => {
    bottomSheetState.backdropComponents = [];
    bottomSheetState.footerComponents = [];
    bottomSheetState.snapToIndex.mockClear();
  });

  it('renders product picker content in a Gorhom sheet with keyboard-aware footer', () => {
    render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>Search products</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-snap-points',
      '60%,92%'
    );
    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-index',
      '0'
    );
    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-pan-down-close',
      'true'
    );
    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-content-panning',
      'true'
    );
    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-keyboard-behavior',
      'interactive'
    );
    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-android-keyboard-input-mode',
      'adjustPan'
    );
    expect(screen.getByTestId('gorhom-sheet-footer')).toHaveTextContent(
      'Search products'
    );
    expect(screen.getByTestId('gorhom-sheet-footer')).toHaveAttribute(
      'data-bottom-inset',
      '14'
    );
    expect(screen.getByText('Product rows')).toBeInTheDocument();
  });

  it('allows callers to lift the keyboard-aware footer above the sheet edge', () => {
    render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>Search customers</span>}
        footerBottomInset={18}
        onClose={vi.fn()}
        title="Select Customer"
        visible={true}
      >
        <span>Customer rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.getByTestId('gorhom-sheet-footer')).toHaveAttribute(
      'data-bottom-inset',
      '30'
    );
  });

  it('does not issue an imperative snap during the initial sheet presentation', () => {
    render(
      <NewOrderProductPickerSheetFrame
        activeIndex={0}
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>Search products</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-index',
      '0'
    );
    expect(bottomSheetState.snapToIndex).not.toHaveBeenCalled();
  });

  it('snaps the mounted sheet when callers move to a higher snap point', () => {
    const view = render(
      <NewOrderProductPickerSheetFrame
        activeIndex={0}
        closeLabel="Close customer sheet"
        colors={colors}
        footer={<span>Search customers</span>}
        onClose={vi.fn()}
        snapPoints={['40%', '74%']}
        title="New Customer"
        visible={true}
      >
        <span>Customer form</span>
      </NewOrderProductPickerSheetFrame>
    );

    view.rerender(
      <NewOrderProductPickerSheetFrame
        activeIndex={1}
        closeLabel="Close customer sheet"
        colors={colors}
        footer={<span>Search customers</span>}
        onClose={vi.fn()}
        snapPoints={['40%', '74%']}
        title="New Customer"
        visible={true}
      >
        <span>Customer form</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-index',
      '1'
    );
    expect(bottomSheetState.snapToIndex).toHaveBeenCalledWith(1);
  });

  it('closes from the backdrop and pan-down callback', () => {
    const onClose = vi.fn();

    render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>Search products</span>}
        onClose={onClose}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close product sheet backdrop' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pan sheet down' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not mount the picker modal when hidden', () => {
    render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        onClose={vi.fn()}
        title="Select Item"
        visible={false}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.queryByLabelText('product-picker-modal')).toBeNull();
  });

  it('keeps the Gorhom footer component stable while footer content changes', () => {
    const { rerender } = render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>phone</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );
    const initialFooterComponent = bottomSheetState.footerComponents.at(-1);

    rerender(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>phone case</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(bottomSheetState.footerComponents.at(-1)).toBe(
      initialFooterComponent
    );
    expect(screen.getByTestId('gorhom-sheet-footer')).toHaveTextContent(
      'phone case'
    );
  });

  it('keeps the Gorhom backdrop component stable while close handlers change', () => {
    const { rerender } = render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>phone</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );
    const initialBackdropComponent = bottomSheetState.backdropComponents.at(-1);

    rerender(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close product sheet"
        colors={colors}
        footer={<span>phone</span>}
        onClose={vi.fn()}
        title="Select Item"
        visible={true}
      >
        <span>Product rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(bottomSheetState.backdropComponents.at(-1)).toBe(
      initialBackdropComponent
    );
  });

  it('allows callers to disable content panning for scroll-first lists', () => {
    render(
      <NewOrderProductPickerSheetFrame
        closeLabel="Close customer sheet"
        colors={colors}
        enableContentPanningGesture={false}
        footer={<span>Search customers</span>}
        onClose={vi.fn()}
        title="Select Customer"
        visible={true}
      >
        <span>Customer rows</span>
      </NewOrderProductPickerSheetFrame>
    );

    expect(screen.getByLabelText('gorhom-bottom-sheet')).toHaveAttribute(
      'data-content-panning',
      'false'
    );
  });
});
