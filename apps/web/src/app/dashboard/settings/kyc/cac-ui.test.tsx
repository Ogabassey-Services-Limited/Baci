import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AlertBanner, CacConfirmStep, StatusBadge } from './cac-ui';

describe('StatusBadge', () => {
  it('shows green styling for "ACTIVE" status', () => {
    // Arrange & Act
    render(<StatusBadge status="ACTIVE" />);

    // Assert
    const badge = screen.getByText('ACTIVE');
    expect(badge).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('shows amber styling for non-active status', () => {
    // Arrange & Act
    render(<StatusBadge status="INACTIVE" />);

    // Assert
    const badge = screen.getByText('INACTIVE');
    expect(badge).toHaveClass('bg-amber-100', 'text-amber-700');
  });

  it('is case-insensitive for active check', () => {
    // Arrange & Act
    render(<StatusBadge status="Active" />);

    // Assert
    const badge = screen.getByText('Active');
    expect(badge).toHaveClass('bg-green-100', 'text-green-700');
  });
});

describe('AlertBanner', () => {
  function MockIcon({ className }: { className?: string }) {
    return <span data-testid="mock-icon" className={className} />;
  }

  it('renders success variant with correct styles', () => {
    // Arrange & Act
    render(
      <AlertBanner variant="success" icon={MockIcon}>
        Operation complete
      </AlertBanner>
    );

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass(
      'border-green-200',
      'bg-green-50',
      'text-green-800'
    );
    expect(screen.getByText('Operation complete')).toBeInTheDocument();
    expect(screen.getByTestId('mock-icon')).toHaveClass('text-green-600');
  });

  it('renders warning variant with correct styles', () => {
    // Arrange & Act
    render(
      <AlertBanner variant="warning" icon={MockIcon}>
        Something wrong
      </AlertBanner>
    );

    // Assert
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass(
      'border-amber-200',
      'bg-amber-50',
      'text-amber-800'
    );
    expect(screen.getByText('Something wrong')).toBeInTheDocument();
    expect(screen.getByTestId('mock-icon')).toHaveClass('text-amber-600');
  });
});

describe('CacConfirmStep', () => {
  const company = {
    approvedName: 'Acme Ltd',
    rcNumber: 'RC-123456',
    status: 'ACTIVE',
  };

  it('renders company details', () => {
    // Arrange & Act
    render(
      <CacConfirmStep company={company} onBack={vi.fn()} onConfirm={vi.fn()} />
    );

    // Assert
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
    expect(screen.getByText('RC-123456')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('calls onBack when Back button is clicked', async () => {
    // Arrange
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <CacConfirmStep company={company} onBack={onBack} onConfirm={vi.fn()} />
    );

    // Act
    await user.click(screen.getByRole('button', { name: /back/i }));

    // Assert
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Confirm button is clicked', async () => {
    // Arrange
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <CacConfirmStep
        company={company}
        onBack={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    // Act
    await user.click(
      screen.getByRole('button', { name: /confirm & upload certificate/i })
    );

    // Assert
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
