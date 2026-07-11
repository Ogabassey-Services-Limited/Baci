import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyV2SavedItems } from './saved';

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: vi.fn(() => ({ basePath: '/ogabassey' })),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children?: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('OgabasseyV2SavedItems', () => {
  it('renders saved products with product links and images', () => {
    render(<OgabasseyV2SavedItems />);

    expect(
      screen.getByRole('heading', { name: /saved items/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'iPhone 15 Pro Max' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'View iPhone 15 Pro Max' })
    ).toHaveAttribute(
      'href',
      expect.stringContaining('/ogabassey/')
    );
    expect(screen.getByText('₦1,950,000')).toBeInTheDocument();
  });

  it('removes a saved product and renders the empty state when all items are removed', () => {
    render(<OgabasseyV2SavedItems />);

    for (const productName of [
      'iPhone 15 Pro Max',
      'MacBook Pro 14"',
      'Sony WH-1000XM5',
      'Samsung Galaxy Watch 6',
    ]) {
      fireEvent.click(
        screen.getByRole('button', {
          name: `Remove ${productName} from saved items`,
        })
      );
    }

    expect(
      screen.getByRole('heading', { name: /no saved items yet/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start shopping/i })).toHaveAttribute(
      'href',
      '/ogabassey'
    );
  });
});
