import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logo } from './logo';

const mockUseMerchantSafe = vi.fn();

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // biome-ignore lint/performance/noImgElement: next/image test stub
    <img src={src} alt={alt} />
  ),
}));

describe('gadgets-pro Logo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the merchant logo image when logo_url is set', () => {
    mockUseMerchantSafe.mockReturnValue({
      merchant: {
        business_name: 'Tech Hub',
        logo_url: 'https://cdn.example.com/logo.png',
      },
    });

    render(<Logo />);

    expect(screen.getByRole('img', { name: 'Tech Hub logo' })).toHaveAttribute(
      'src',
      'https://cdn.example.com/logo.png'
    );
  });

  it('falls back to the merchant business name when there is no logo', () => {
    mockUseMerchantSafe.mockReturnValue({
      merchant: { business_name: 'Tech Hub', logo_url: null },
    });

    render(<Logo />);

    expect(screen.getByText('Tech Hub')).toBeInTheDocument();
  });

  it('renders nothing outside a merchant context', () => {
    mockUseMerchantSafe.mockReturnValue(null);

    const { container } = render(<Logo />);

    expect(container).toBeEmptyDOMElement();
  });
});
