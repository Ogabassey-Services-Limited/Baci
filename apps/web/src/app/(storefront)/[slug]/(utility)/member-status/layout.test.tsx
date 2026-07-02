import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const customerAuthLayoutMock = vi.fn(
  ({ children }: { children: ReactNode; params: { slug: string } }) => (
    <div data-testid="customer-auth-layout">{children}</div>
  )
);

vi.mock('@/app/(storefront)/[slug]/customer-auth-layout', () => ({
  default: (props: { children: ReactNode; params: { slug: string } }) =>
    customerAuthLayoutMock(props),
}));

import MemberStatusLayout from './layout';

describe('MemberStatusLayout', () => {
  it('wraps the member status route in CustomerAuthLayout with the resolved slug', async () => {
    const node = await MemberStatusLayout({
      children: <div>Member status content</div>,
      params: Promise.resolve({ slug: 'OgaBassey' }),
    });

    render(node);

    expect(screen.getByTestId('customer-auth-layout')).toBeInTheDocument();
    expect(screen.getByText('Member status content')).toBeInTheDocument();
    expect(customerAuthLayoutMock.mock.calls[0]?.[0]).toMatchObject({
      params: { slug: 'ogabassey' },
    });
  });
});
