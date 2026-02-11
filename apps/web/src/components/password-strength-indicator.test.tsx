import { render, screen } from '@testing-library/react';
import { PasswordStrengthIndicator } from './password-strength-indicator';

describe('PasswordStrengthIndicator', () => {
  it('renders nothing when strength is 0', () => {
    const { container } = render(<PasswordStrengthIndicator strength={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders with accessibility attributes when strength is > 0', () => {
    render(<PasswordStrengthIndicator strength={1} />);

    const meter = screen.getByRole('meter');
    expect(meter).toBeInTheDocument();
    expect(meter).toHaveAttribute('aria-label', 'Password strength');
    expect(meter).toHaveAttribute('aria-valuenow', '1');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '3');
    expect(meter).toHaveAttribute('aria-valuetext', 'Weak');
  });

  it('updates aria-valuetext correctly for stronger passwords', () => {
    render(<PasswordStrengthIndicator strength={3} />);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '3');
    expect(meter).toHaveAttribute('aria-valuetext', 'Strong');
  });
});
