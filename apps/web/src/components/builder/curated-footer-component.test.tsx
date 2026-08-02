import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, it, vi } from 'vitest';
import { CuratedFooter } from './curated-footer-component';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));

it('renders deterministic merchant copy without empty social content or reduced text opacity', () => {
  render(
    <CuratedFooter
      brandName="North Star"
      copyrightText="© North Star. All rights reserved."
      quickLinksLabel="Explore"
      socialLinksLabel="Connect"
      showQuickLinks
      quickLinks={[{ label: 'About Us', url: '/about' }]}
      socialLinks={{}}
    />
  );

  expect(
    screen.getByRole('heading', { name: 'North Star' })
  ).toBeInTheDocument();
  expect(
    screen.getByText('© North Star. All rights reserved.')
  ).not.toHaveClass('opacity-80');
  expect(screen.getByRole('heading', { name: 'Explore' })).toBeInTheDocument();
  expect(
    screen.queryByRole('heading', { name: 'Connect' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'About Us' })).not.toHaveClass(
    'opacity-80'
  );
});
