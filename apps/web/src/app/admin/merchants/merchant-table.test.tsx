import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminMerchantHealthRow } from '@/types/admin-merchants';
import { MerchantTable } from './merchant-table';

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href?.toString() ?? '#'} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    asChild,
    children,
    disabled,
    onClick,
  }: {
    asChild?: boolean;
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) =>
    asChild ? (
      children
    ) : (
      <button type="button" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  DropdownMenuLabel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const merchant: AdminMerchantHealthRow = {
  active_days: 12,
  business_name: 'Baci Store',
  email: 'owner@example.com',
  health_status: 'healthy',
  joined_at: '2026-03-20T10:00:00.000Z',
  last_order_date: '2026-03-24T10:00:00.000Z',
  merchant_id: '11111111-1111-4111-8111-111111111111',
  total_gmv: 1200,
  total_orders: 4,
};

describe('MerchantTable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders merchant health, metrics, dates, and directory links', () => {
    render(
      <MerchantTable merchants={[merchant]} onInvalidStorefrontUrl={vi.fn()} />
    );

    expect(screen.getByRole('link', { name: 'Baci Store' })).toHaveAttribute(
      'href',
      '/admin/merchants/11111111-1111-4111-8111-111111111111'
    );
    expect(screen.getByText('owner@example.com')).toBeVisible();
    expect(screen.getByText('Healthy')).toBeVisible();
    expect(screen.getByText('₦1.2K')).toBeVisible();
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('Mar 24, 2026')).toBeVisible();
    expect(screen.getByText('Mar 20, 2026')).toBeVisible();
  });

  it('renders an empty table state when there are no merchants', () => {
    render(<MerchantTable merchants={[]} onInvalidStorefrontUrl={vi.fn()} />);

    expect(screen.getByText('No merchants found')).toBeVisible();
  });

  it('uses mailto links and opens the canonical storefront identifier', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MerchantTable merchants={[merchant]} onInvalidStorefrontUrl={vi.fn()} />
    );

    expect(screen.getByRole('link', { name: /send email/i })).toHaveAttribute(
      'href',
      'mailto:owner@example.com'
    );

    fireEvent.click(screen.getByRole('button', { name: /view store/i }));

    expect(openSpy).toHaveBeenCalledWith(
      '/11111111-1111-4111-8111-111111111111',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('disables email and reports invalid storefront links when no identifier can be built', () => {
    const onInvalidStorefrontUrl = vi.fn();
    const invalidMerchant: AdminMerchantHealthRow = {
      ...merchant,
      business_name: null,
      email: null,
      merchant_id: '',
    };

    render(
      <MerchantTable
        merchants={[invalidMerchant]}
        onInvalidStorefrontUrl={onInvalidStorefrontUrl}
      />
    );

    expect(screen.getByRole('button', { name: /send email/i })).toBeDisabled();
    expect(screen.getByText('No email')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /view store/i }));

    expect(onInvalidStorefrontUrl).toHaveBeenCalledTimes(1);
  });

  it('disables email while preserving storefront links when only email is missing', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const onInvalidStorefrontUrl = vi.fn();

    render(
      <MerchantTable
        merchants={[{ ...merchant, email: null }]}
        onInvalidStorefrontUrl={onInvalidStorefrontUrl}
      />
    );

    expect(screen.getByRole('button', { name: /send email/i })).toBeDisabled();
    expect(screen.getByText('No email')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /view store/i }));

    expect(onInvalidStorefrontUrl).not.toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(
      '/11111111-1111-4111-8111-111111111111',
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('keeps email actions enabled and reports invalid storefront links when only merchant id is missing', () => {
    const onInvalidStorefrontUrl = vi.fn();

    render(
      <MerchantTable
        merchants={[
          {
            ...merchant,
            business_name: null,
            merchant_id: null as unknown as string,
          },
        ]}
        onInvalidStorefrontUrl={onInvalidStorefrontUrl}
      />
    );

    expect(screen.getByRole('link', { name: /send email/i })).toHaveAttribute(
      'href',
      'mailto:owner@example.com'
    );

    fireEvent.click(screen.getByRole('button', { name: /view store/i }));

    expect(onInvalidStorefrontUrl).toHaveBeenCalledTimes(1);
  });
});
