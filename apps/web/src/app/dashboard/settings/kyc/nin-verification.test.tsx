import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import { NinVerification } from './nin-verification';

const baseProps = {
  verified: false,
  prefillNin: null,
  prefillFirstName: null,
  prefillLastName: null,
  prefillDateOfBirth: null,
  onVerified: vi.fn(),
};

describe('NinVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows verified alert when verified=true', () => {
    // Arrange & Act
    render(<NinVerification {...baseProps} verified={true} />);

    // Assert
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Your NIN has been verified.')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('renders form fields when verified=false', () => {
    // Arrange & Act
    render(<NinVerification {...baseProps} />);

    // Assert
    expect(screen.getByLabelText(/nin/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /verify nin/i })
    ).toBeInTheDocument();
  });

  it('pre-fills form from props', () => {
    // Arrange
    const props = {
      ...baseProps,
      prefillNin: '12345678901',
      prefillFirstName: 'Jane',
      prefillLastName: 'Doe',
      prefillDateOfBirth: '1990-05-20',
    };

    // Act
    render(<NinVerification {...props} />);

    // Assert
    expect(screen.getByLabelText(/nin/i)).toHaveValue('12345678901');
    expect(screen.getByLabelText(/first name/i)).toHaveValue('Jane');
    expect(screen.getByLabelText(/last name/i)).toHaveValue('Doe');
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue('1990-05-20');
  });
});
