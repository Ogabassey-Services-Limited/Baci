import { fireEvent, render, screen } from '@testing-library/react';
import type { CartItem } from '@/hooks/cart';
import { describe, expect, it, vi } from 'vitest';
import { CartPageNegotiationModeDialog } from './cart-page-negotiation-mode-dialog';

const pendingItem = {
  id: 'p1',
  cartItemId: 'ci-1',
  name: 'Test Gadget',
  description: 'A test gadget.',
  status: 'active',
  price: 25_000,
  manage_stock: true,
  stock: 8,
  quantity: 1,
  image: '/gadget.jpg',
  imageLarge: '/gadget-large.jpg',
  imageHint: 'gadget product photo',
  category: 'electronics',
  brand: 'Brand',
  gtin: '',
  mpn: '',
} satisfies CartItem;

function renderDialog(overrides = {}) {
  const props = {
    hasNonNegotiableCartItem: false,
    isOpen: true,
    onCancel: vi.fn(),
    onOpenPendingItem: vi.fn(),
    onOpenTotalNegotiation: vi.fn(),
    pendingItem,
    ...overrides,
  };

  const view = render(<CartPageNegotiationModeDialog {...props} />);

  return { ...props, ...view };
}

describe('CartPageNegotiationModeDialog', () => {
  it('renders nothing when closed', () => {
    renderDialog({ isOpen: false });

    expect(
      screen.queryByRole('heading', { name: /choose negotiation mode/i })
    ).not.toBeInTheDocument();
  });

  it('wires item, total, and cancel actions', () => {
    const props = renderDialog();

    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      /choose negotiation mode/i
    );

    fireEvent.click(screen.getByRole('button', { name: /negotiate this item/i }));
    fireEvent.click(
      screen.getByRole('button', { name: /bulk negotiate entire cart/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(props.onOpenPendingItem).toHaveBeenCalledWith(pendingItem);
    expect(props.onOpenTotalNegotiation).toHaveBeenCalledTimes(1);
    expect(props.onCancel).toHaveBeenCalledTimes(2);
  });

  it('focuses the dialog and supports Escape dismissal', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open negotiation';
    document.body.appendChild(opener);
    opener.focus();

    const props = renderDialog();
    const dialog = screen.getByRole('dialog', {
      name: /choose negotiation mode/i,
    });

    expect(dialog).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(props.onCancel).toHaveBeenCalledTimes(1);

    props.unmount();
    expect(opener).toHaveFocus();

    document.body.removeChild(opener);
  });
});
