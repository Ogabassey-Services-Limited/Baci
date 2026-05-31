import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VerificationBadge } from './VerificationBadge';

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

describe('VerificationBadge', () => {
  it('shows loading state with "Verifying customer…" text', () => {
    render(
      <VerificationBadge
        verified={false}
        isLoading={true}
      />
    );

    expect(screen.getByText('Verifying customer…')).toBeInTheDocument();
  });

  it('shows verified state with customer name', () => {
    render(
      <VerificationBadge
        verified={true}
        customerName="John Doe"
        isLoading={false}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows "Customer verified" text when verified', () => {
    render(
      <VerificationBadge
        verified={true}
        customerName="Jane Smith"
        isLoading={false}
      />
    );

    expect(screen.getByText('Customer verified')).toBeInTheDocument();
  });

  it('shows error state with custom message', () => {
    render(
      <VerificationBadge
        verified={false}
        message="Invalid smart card number"
        isLoading={false}
      />
    );

    expect(screen.getByText('Invalid smart card number')).toBeInTheDocument();
  });

  it('shows default "Verification failed" when no message provided', () => {
    render(
      <VerificationBadge
        verified={false}
        isLoading={false}
      />
    );

    expect(screen.getByText('Verification failed')).toBeInTheDocument();
  });
});
