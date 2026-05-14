import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/ogabassey',
}));
vi.mock('@/hooks/merchant/use-merchant', () => ({
  useMerchant: () => ({ basePath: '/ogabassey' }),
}));
vi.mock('./logo', () => ({ Logo: () => <div>Logo</div> }));

import { MobileMenu } from './mobile-menu';

describe('OgabasseyMobileMenu', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MobileMenu isOpen={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders navigation links when open', () => {
    render(<MobileMenu isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Profile')).toBeTruthy();
  });
});
