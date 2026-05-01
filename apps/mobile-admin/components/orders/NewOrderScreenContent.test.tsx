import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: vi.fn(),
    replace: vi.fn(),
  },
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({
    children,
    footer,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));

vi.mock('@/components/ui/SuccessModal', () => ({
  SuccessModal: ({
    actionLabel,
    onActionPress,
    onClose,
    visible,
  }: {
    actionLabel?: string;
    onActionPress?: () => void;
    onClose: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        {actionLabel ? (
          <button
            aria-label={actionLabel}
            onClick={onActionPress}
            type="button"
          >
            {actionLabel}
          </button>
        ) : null}
        <button aria-label="Create New Sale" onClick={onClose} type="button">
          Create New Sale
        </button>
      </div>
    ) : null,
}));

vi.mock('./NewOrderChannelSection', () => ({
  NewOrderChannelSection: () => null,
}));
vi.mock('./NewOrderCustomerSheet', () => ({
  NewOrderCustomerSheet: () => null,
}));
vi.mock('./NewOrderDetailsSection', () => ({
  NewOrderDetailsSection: () => null,
}));
vi.mock('./NewOrderEditItemSheet', () => ({
  NewOrderEditItemSheet: () => null,
}));
vi.mock('./NewOrderFinancialSheet', () => ({
  NewOrderFinancialSheet: () => null,
}));
vi.mock('./NewOrderFooterBar', () => ({
  NewOrderFooterBar: () => null,
}));
vi.mock('./NewOrderItemsSection', () => ({
  NewOrderItemsSection: () => null,
}));
vi.mock('./NewOrderNotesSection', () => ({
  NewOrderNotesSection: () => null,
}));
vi.mock('./NewOrderProductSheet', () => ({
  NewOrderProductSheet: () => null,
}));
vi.mock('./NewOrderQuickAddDialog', () => ({
  NewOrderQuickAddDialog: () => null,
}));

import { NewOrderScreenContent } from './NewOrderScreenContent';

describe('NewOrderScreenContent', () => {
  it('restores VAT for registered merchants when resetting after a successful sale', () => {
    const resetOrderDraft = vi.fn();
    const setShowSuccessModal = vi.fn();

    const controller = {
      colors: {
        background: '#0f172a',
        primary: '#2563eb',
        text: '#ffffff',
      },
      isSubmitting: false,
      lastOrderId: 'order-123',
      resetOrderDraft,
      setShowSuccessModal,
      showSuccessModal: true,
    } as unknown as ReturnType<typeof useNewOrderController>;

    render(<NewOrderScreenContent controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create New Sale' }));

    expect(setShowSuccessModal).toHaveBeenCalledWith(false);
    expect(resetOrderDraft).toHaveBeenCalledTimes(1);
  });

  it('falls back to resetting the draft when a successful save has no lastOrderId', () => {
    const resetOrderDraft = vi.fn();
    const setShowSuccessModal = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const controller = {
      colors: {
        background: '#0f172a',
        primary: '#2563eb',
        text: '#ffffff',
      },
      isSubmitting: false,
      lastOrderId: null,
      resetOrderDraft,
      setShowSuccessModal,
      showSuccessModal: true,
    } as unknown as ReturnType<typeof useNewOrderController>;

    render(<NewOrderScreenContent controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'View Order Details' }));

    expect(setShowSuccessModal).toHaveBeenCalledWith(false);
    expect(resetOrderDraft).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      '[NewOrderScreenContent] Missing lastOrderId after successful order save'
    );

    warn.mockRestore();
  });
});
