import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MerchantUsersLoading from '@/app/admin/merchants/[merchantId]/loading';

describe('MerchantUsersLoading', () => {
  it('renders a route loading state with summary and directory placeholders', () => {
    render(<MerchantUsersLoading />);

    expect(
      screen.getByRole('status', { name: 'Loading merchant users' })
    ).toBeInTheDocument();
  });
});
