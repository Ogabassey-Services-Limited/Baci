import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ usePathname: () => '/ogabassey/account' }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as React.ReactNode}</a> }));
vi.mock('@/contexts/customer-auth-context', () => ({
  useCustomerAuth: () => ({
    customer: { first_name: 'Test', last_name: 'User', email: 'test@example.com' },
    logout: vi.fn(),
    isAuthenticated: true,
  }),
}));
vi.mock('@/components/storefront/ogabassey/providers/v2-saved-context', () => ({
  useV2Saved: () => ({ savedItems: [] }),
}));

import { OgabasseyV2Profile } from './profile';

describe('OgabasseyV2Profile', () => {
  it('renders without crashing', () => {
    render(<OgabasseyV2Profile />);
    expect(document.body).toBeTruthy();
  });

  it('shows customer name', () => {
    render(<OgabasseyV2Profile />);
    expect(screen.getByText('Test User')).toBeTruthy();
  });
});
