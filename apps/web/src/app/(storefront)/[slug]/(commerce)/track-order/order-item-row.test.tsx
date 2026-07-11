import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderItemRow, type TrackOrderItem } from './order-item-row';

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    className?: string;
    fill?: boolean;
    sizes?: string;
    src: string;
  }) => <span aria-label={alt} data-src={src} role="img" />,
}));

const baseItem: TrackOrderItem = {
  id: 'item-1',
  product_name: '13" MacBook Air M2 (2022)',
  quantity: 1,
  unit_price: 690000,
  total_price: 690000,
  product_image: 'https://cdn.example.com/macbook.jpg',
};

const formatCurrency = (amount: number, currency = 'NGN') =>
  `${currency} ${amount}`;

describe('OrderItemRow', () => {
  it('renders quantity, price, image, and option metadata', () => {
    render(
      <OrderItemRow
        currency="NGN"
        formatCurrency={formatCurrency}
        item={{
          ...baseItem,
          condition: 'open_box',
          variant_name: '512GB',
        }}
      />
    );

    expect(screen.getByText('13" MacBook Air M2 (2022)')).toBeInTheDocument();
    expect(screen.getByText('Open Box / 512GB')).toBeInTheDocument();
    expect(screen.getByText('Qty: 1')).toBeInTheDocument();
    expect(screen.getByText('NGN 690000')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /macbook air/i })).toHaveAttribute(
      'data-src',
      'https://cdn.example.com/macbook.jpg'
    );
  });

  it('omits option metadata when condition and variant are absent', () => {
    render(
      <OrderItemRow
        currency="NGN"
        formatCurrency={formatCurrency}
        item={baseItem}
      />
    );

    expect(screen.queryByText('Open Box')).not.toBeInTheDocument();
    expect(screen.queryByText('512GB')).not.toBeInTheDocument();
  });
});
