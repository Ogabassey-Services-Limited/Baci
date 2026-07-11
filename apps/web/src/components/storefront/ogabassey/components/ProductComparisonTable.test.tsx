import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product } from '../types';

const mockUseMerchantSafe = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock('next/image', () => ({
  // biome-ignore lint/performance/noImgElement: test double
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt} />
  ),
}));

// Product images now render through CdnFormatImage (explicit per-format
// <picture>); surface it as a plain <img> so these tests keep asserting table
// behavior.
vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    const { fill: _fill, preload: _preload, ...rest } = props;
    // biome-ignore lint/performance/noImgElement: test double
    return <img {...rest} alt={String(props.alt ?? '')} />;
  },
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: mockUseMerchantSafe,
}));

import { ProductComparisonTable } from './ProductComparisonTable';

function createMainProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'main-product',
    merchantId: 'merchant-1',
    name: 'Samsung Galaxy Z TriFold',
    slug: 'samsung-galaxy-z-trifold',
    price: '₦7,150,000',
    rawPrice: 7150000,
    image: 'https://example.com/main.jpg',
    images: ['https://example.com/main.jpg'],
    description: 'Flagship foldable',
    category: 'Smartphones',
    categorySlug: 'smartphones',
    condition: 'new',
    brand: 'Samsung',
    specs: [
      { label: 'Display', value: '10 inches' },
      { label: 'RAM', value: '16GB' },
      { label: 'Storage', value: '512GB' },
      { label: 'Battery', value: '5600mAh' },
    ],
    detailedSpecs: [
      {
        category: 'Display',
        items: [{ label: 'Size', value: '10 inches' }],
      },
      {
        category: 'Memory',
        items: [
          { label: 'RAM', value: '16GB' },
          { label: 'Internal Storage', value: '512GB' },
        ],
      },
      {
        category: 'Battery',
        items: [{ label: 'Capacity', value: '5600mAh' }],
      },
    ],
    ...overrides,
  };
}

describe('ProductComparisonTable', () => {
  beforeEach(() => {
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/ogabassey',
      merchant: {
        country: 'NG',
        payout_currency: 'NGN',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders the main product key specs summary rows from the product specs array', () => {
    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    const keySpecsRow = screen.getByText('Key Specs').closest('.grid');

    expect(keySpecsRow).not.toBeNull();

    const keySpecs = within(keySpecsRow as HTMLElement);
    expect(keySpecs.getByText('Display')).toBeInTheDocument();
    expect(keySpecs.getByText('10 inches')).toBeInTheDocument();
    expect(keySpecs.getByText('RAM')).toBeInTheDocument();
    expect(keySpecs.getByText('16GB')).toBeInTheDocument();
    expect(keySpecs.getByText('Storage')).toBeInTheDocument();
    expect(keySpecs.getByText('512GB')).toBeInTheDocument();
    expect(keySpecs.getByText('Battery')).toBeInTheDocument();
    expect(keySpecs.getByText('5600mAh')).toBeInTheDocument();
  });

  it('moves focus into comparison search when opening an empty slot', () => {
    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );

    expect(
      screen.getByRole('textbox', { name: /search products/i })
    ).toHaveFocus();
  });

  it('uses merchant payout currency when formatting searched comparison products', async () => {
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/ogabassey',
      merchant: {
        country: 'US',
        payout_currency: 'USD',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            id: 'ipad-pro',
            name: 'iPad Pro',
            slug: 'ipad-pro',
            price: 1500,
            image: 'https://example.com/ipad.jpg',
            category: 'Smartphones',
            condition: 'new',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'ipad' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/storefront/products?'),
      expect.objectContaining({ signal: expect.any(Object) })
    );
    expect(await screen.findByText('$1,500.00')).toBeInTheDocument();

    const resultButton = screen.getByText('iPad Pro').closest('button');
    expect(resultButton).not.toBeNull();
    fireEvent.click(resultButton as HTMLButtonElement);

    expect(screen.getByText('$1,500.00')).toBeInTheDocument();
  });

  it('shows loading feedback and a user-visible error when search fails', async () => {
    let rejectSearch!: (reason?: unknown) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectSearch = reject;
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'iphone' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      screen.getByRole('status', { name: /loading products/i })
    ).toBeInTheDocument();

    await act(async () => {
      rejectSearch(new Error('Network down'));
      await Promise.resolve();
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load products/i
    );
    expect(
      screen.queryByRole('status', { name: /loading products/i })
    ).not.toBeInTheDocument();
  });

  it('shows a user-visible error when search returns a non-OK response', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ products: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'pixel' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not load products/i
    );
  });

  it('falls back to NGN when payout_currency is not set', async () => {
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/ogabassey',
      merchant: {
        country: 'NG',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            id: 'galaxy-a-series',
            name: 'Galaxy A Series',
            slug: 'galaxy-a-series',
            price: 50000,
            image: 'https://example.com/galaxy.jpg',
            category: 'Smartphones',
            condition: 'new',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'galaxy' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(await screen.findByText('₦50,000.00')).toBeInTheDocument();
  });

  it('falls back to NGN when payout_currency is invalid', async () => {
    mockUseMerchantSafe.mockReturnValue({
      basePath: '/ogabassey',
      merchant: {
        country: 'NG',
        payout_currency: 'XXX',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            id: 'galaxy-a-series',
            name: 'Galaxy A Series',
            slug: 'galaxy-a-series',
            price: 50000,
            image: 'https://example.com/galaxy.jpg',
            category: 'Smartphones',
            condition: 'new',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'galaxy' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(await screen.findByText('₦50,000.00')).toBeInTheDocument();
  });


  it('keeps custom-domain comparison product links root-relative when context basePath is empty', async () => {
    mockUseMerchantSafe.mockReturnValue({
      basePath: '',
      merchant: {
        country: 'NG',
        payout_currency: 'NGN',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        products: [
          {
            id: 'pixel-pro',
            name: 'Pixel Pro',
            slug: 'pixel-pro',
            price: 900000,
            image: 'https://example.com/pixel.jpg',
            category: 'Smartphones',
            condition: 'new',
          },
        ],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey.com"
      />
    );

    fireEvent.click(
      screen.getAllByRole('button', { name: /compare similar smartphones/i })[0]
    );
    fireEvent.change(screen.getByRole('textbox', { name: /search products/i }), {
      target: { value: 'pixel' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fireEvent.click(await screen.findByText('Pixel Pro'));

    expect(screen.getByRole('link', { name: 'Pixel Pro' })).toHaveAttribute(
      'href',
      '/smartphones/pixel-pro'
    );
  });

  it('uses storefront theme tokens for the current product header', () => {
    render(
      <ProductComparisonTable
        mainProduct={createMainProduct()}
        storeSlug="ogabassey"
      />
    );

    expect(screen.getByText('Current')).toHaveClass(
      'bg-store-primary',
      'text-store-primary-text'
    );
    expect(screen.getByText('₦7,150,000')).toHaveClass('text-store-primary');
  });
});
