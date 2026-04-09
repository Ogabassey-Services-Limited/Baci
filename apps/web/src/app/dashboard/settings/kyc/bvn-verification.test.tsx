import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { BvnVerification } from './bvn-verification';

const baseProps = {
  verified: false,
  prefillBvn: null,
  prefillFirstName: null,
  prefillLastName: null,
  prefillDateOfBirth: null,
  prefillPhone: null,
  onVerified: vi.fn(),
};

describe('BvnVerification', () => {
  it('shows verified alert when verified=true', () => {
    // Arrange & Act
    render(<BvnVerification {...baseProps} verified={true} />);

    // Assert
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Your BVN has been verified.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders form fields including mobile number when verified=false', () => {
    // Arrange & Act
    render(<BvnVerification {...baseProps} />);

    // Assert
    expect(screen.getByLabelText(/bvn/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/mobile number/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify bvn/i })
    ).toBeInTheDocument();
  });

  it('pre-fills form from props', () => {
    // Arrange
    const props = {
      ...baseProps,
      prefillBvn: '22345678901',
      prefillFirstName: 'John',
      prefillLastName: 'Smith',
      prefillDateOfBirth: '1985-12-01',
      prefillPhone: '08012345678',
    };

    // Act
    render(<BvnVerification {...props} />);

    // Assert
    expect(screen.getByLabelText(/bvn/i)).toHaveValue('22345678901');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('John');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Smith');
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('1985-12-01');
    expect(screen.getByLabelText(/mobile number/i)).toHaveValue('08012345678');
  });
});
