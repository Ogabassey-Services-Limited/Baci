import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VerificationBadge } from './verification-badge';

describe('VerificationBadge', () => {
  it('shows "Verified" text and green styling when verified', () => {
    // Arrange & Act
    render(<VerificationBadge verified />);

    // Assert
    expect(screen.getByText('Verified')).toBeInTheDocument();
    const badge = screen.getByText('Verified').closest('span');
    expect(badge).toHaveClass('bg-green-50', 'text-green-700');
  });

  it('shows "Not Started" text and gray styling when not verified', () => {
    // Arrange & Act
    render(<VerificationBadge verified={false} />);

    // Assert
    expect(screen.getByText('Not Started')).toBeInTheDocument();
    const badge = screen.getByText('Not Started').closest('span');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-500');
  });
});
