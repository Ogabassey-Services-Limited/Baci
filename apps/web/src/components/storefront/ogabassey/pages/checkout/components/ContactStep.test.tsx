import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ContactStep } from './ContactStep';

// Mock PhoneInput component
vi.mock('@/components/ui/phone-input', () => ({
  PhoneInput: vi.fn(({ id, value, onChange, placeholder, defaultCountry }) => (
    <input
      id={id}
      data-testid="phone-input"
      type="tel"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-country={defaultCountry}
    />
  )),
}));

// Mock react-phone-number-input
vi.mock('react-phone-number-input', () => ({
  isValidPhoneNumber: vi.fn((phone: string) => {
    // Simple validation: must start with + and have at least 10 digits
    return /^\+\d{10,}$/.test(phone);
  }),
}));

describe('ContactStep', () => {
  const defaultProps = {
    currentStep: 'contact' as const,
    completedSteps: { contact: false, delivery: false },
    firstName: '',
    lastName: '',
    customerEmail: '',
    customerPhone: '',
    setFirstName: vi.fn(),
    setLastName: vi.fn(),
    setCustomerEmail: vi.fn(),
    setCustomerPhone: vi.fn(),
    contactValidationAttempted: false,
    isContactValid: true,
    user: null,
    createAccount: false,
    setCreateAccount: vi.fn(),
    accountPassword: '',
    setAccountPassword: vi.fn(),
    showPasswordInput: false,
    setShowPasswordInput: vi.fn(),
    isPasswordVisible: false,
    setIsPasswordVisible: vi.fn(),
    setCurrentStep: vi.fn(),
    setCompletedSteps: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders contact form when currentStep is contact', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Assert
      expect(screen.getByRole('heading', { name: /Contact Information/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('John')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Doe')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('john@example.com')).toBeInTheDocument();
      expect(screen.getByTestId('phone-input')).toBeInTheDocument();
    });

    it('associates contact labels with their controls', () => {
      render(<ContactStep {...defaultProps} />);

      expect(screen.getByLabelText('First Name *')).toBe(screen.getByPlaceholderText('John'));
      expect(screen.getByLabelText('Last Name *')).toBe(screen.getByPlaceholderText('Doe'));
      expect(screen.getByLabelText('Email Address *')).toBe(screen.getByPlaceholderText('john@example.com'));
      expect(screen.getByLabelText('Phone Number *')).toBe(screen.getByTestId('phone-input'));
    });

    it('renders collapsed state when currentStep is not contact', () => {
      // Arrange
      const { container } = render(<ContactStep {...defaultProps} currentStep="delivery" />);

      // Assert
      const heading = screen.getByRole('heading', { name: /Contact Information/i });
      expect(heading).toBeInTheDocument();

      // Form inputs should not be visible (opacity-0 class)
      const collapsibleDiv = container.querySelector('.grid.transition-all');
      expect(collapsibleDiv).toHaveClass('opacity-0');
    });

    it('shows completed state with checkmark when contact step is complete', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          currentStep="delivery"
          completedSteps={{ contact: true, delivery: false }}
        />
      );

      // Assert
      const heading = screen.getByRole('heading', { name: /Contact Information/i });
      const checkmarkContainer = heading.querySelector('.bg-green-100');
      expect(checkmarkContainer).toBeInTheDocument();
    });

    it('shows Edit button when contact step is complete and not current', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          currentStep="delivery"
          completedSteps={{ contact: true, delivery: false }}
        />
      );

      // Assert
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('does not show Edit button when contact step is current', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          currentStep="contact"
          completedSteps={{ contact: true, delivery: false }}
        />
      );

      // Assert
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('renders step number 1 when contact step is not complete', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Assert
      const heading = screen.getByRole('heading', { name: /Contact Information/i });
      expect(heading.textContent).toContain('1');
    });
  });

  describe('Form Interactions', () => {
    it('calls setFirstName when first name input changes', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Act
      const input = screen.getByPlaceholderText('John');
      fireEvent.change(input, { target: { value: 'Jane' } });

      // Assert
      expect(defaultProps.setFirstName).toHaveBeenCalledTimes(1);
      expect(defaultProps.setFirstName).toHaveBeenCalledWith('Jane');
    });

    it('calls setLastName when last name input changes', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Act
      const input = screen.getByPlaceholderText('Doe');
      fireEvent.change(input, { target: { value: 'Smith' } });

      // Assert
      expect(defaultProps.setLastName).toHaveBeenCalledTimes(1);
      expect(defaultProps.setLastName).toHaveBeenCalledWith('Smith');
    });

    it('calls setCustomerEmail when email input changes', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Act
      const input = screen.getByPlaceholderText('john@example.com');
      fireEvent.change(input, { target: { value: 'test@example.com' } });

      // Assert
      expect(defaultProps.setCustomerEmail).toHaveBeenCalledTimes(1);
      expect(defaultProps.setCustomerEmail).toHaveBeenCalledWith('test@example.com');
    });

    it('calls setCustomerPhone when phone input changes', () => {
      // Arrange
      render(<ContactStep {...defaultProps} />);

      // Act
      const input = screen.getByTestId('phone-input');
      fireEvent.change(input, { target: { value: '+2348012345678' } });

      // Assert
      expect(defaultProps.setCustomerPhone).toHaveBeenCalledTimes(1);
      expect(defaultProps.setCustomerPhone).toHaveBeenCalledWith('+2348012345678');
    });
  });

  describe('Validation', () => {
    it('shows first name validation error when contactValidationAttempted is true and firstName is empty', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          firstName=""
        />
      );

      // Assert
      expect(screen.getByText('First name is required')).toBeInTheDocument();
    });

    it('shows last name validation error when contactValidationAttempted is true and lastName is empty', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          lastName=""
        />
      );

      // Assert
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
    });

    it('shows email required error when contactValidationAttempted is true and email is empty', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerEmail=""
        />
      );

      // Assert
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });

    it('shows invalid email error when contactValidationAttempted is true and email is invalid', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerEmail="invalid-email"
        />
      );

      // Assert
      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('shows phone required error when contactValidationAttempted is true and phone is empty', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerPhone=""
        />
      );

      // Assert
      expect(screen.getByText('Phone number is required')).toBeInTheDocument();
    });

    it('shows invalid phone error when contactValidationAttempted is true and phone is invalid', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerPhone="123"
        />
      );

      // Assert
      expect(screen.getByText('Please enter a valid phone number')).toBeInTheDocument();
    });

    it('does not show validation errors when contactValidationAttempted is false', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={false}
          firstName=""
          lastName=""
          customerEmail=""
          customerPhone=""
        />
      );

      // Assert
      expect(screen.queryByText('First name is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Last name is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Email address is required')).not.toBeInTheDocument();
      expect(screen.queryByText('Phone number is required')).not.toBeInTheDocument();
    });

    it('shows password validation error when createAccount is true and password is too short', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          createAccount={true}
          showPasswordInput={true}
          accountPassword="12345"
        />
      );

      // Assert
      expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    });
  });

  describe('Continue Button', () => {
    it('calls setCompletedSteps and setCurrentStep when Continue button is clicked', () => {
      // Arrange
      render(<ContactStep {...defaultProps} isContactValid={true} />);

      // Act
      const button = screen.getByRole('button', { name: /Continue to Delivery/i });
      fireEvent.click(button);

      // Assert
      expect(defaultProps.setCompletedSteps).toHaveBeenCalledTimes(1);
      expect(defaultProps.setCurrentStep).toHaveBeenCalledWith('delivery');
    });

    it('disables continue button when isContactValid is false', () => {
      // Arrange
      render(<ContactStep {...defaultProps} isContactValid={false} />);

      // Assert
      const button = screen.getByRole('button', { name: /Continue to Delivery/i });
      expect(button).toBeDisabled();
    });

    it('disables continue button when createAccount is true and password is too short', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          isContactValid={true}
          createAccount={true}
          accountPassword="12345"
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /Continue to Delivery/i });
      expect(button).toBeDisabled();
    });

    it('enables continue button when contact is valid and password requirements are met', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          isContactValid={true}
          createAccount={true}
          accountPassword="password123"
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /Continue to Delivery/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('Account Creation', () => {
    it('does not show account creation section when user is logged in', () => {
      // Arrange
      render(<ContactStep {...defaultProps} user={{ id: '123' }} />);

      // Assert
      expect(screen.queryByText(/Save my information for a faster checkout next time/i)).not.toBeInTheDocument();
    });

    it('shows account creation checkbox when user is not logged in', () => {
      // Arrange
      render(<ContactStep {...defaultProps} user={null} />);

      // Assert
      expect(screen.getByRole('checkbox')).toBeInTheDocument();
      expect(screen.getByText(/Save my information for a faster checkout next time/i)).toBeInTheDocument();
    });

    it('calls setCreateAccount and setShowPasswordInput when checkbox is clicked', () => {
      // Arrange
      render(<ContactStep {...defaultProps} user={null} />);

      // Act
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Assert
      expect(defaultProps.setCreateAccount).toHaveBeenCalledWith(true);
      expect(defaultProps.setShowPasswordInput).toHaveBeenCalledWith(true);
    });

    it('shows password input when showPasswordInput is true', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={true}
          createAccount={true}
        />
      );

      // Assert
      expect(screen.getByPlaceholderText('Min. 6 characters')).toBeInTheDocument();
    });

    it('hides password input when showPasswordInput is false', () => {
      // Arrange
      const { container } = render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={false}
        />
      );

      // Assert
      // Password input should have max-h-0 and opacity-0 classes when hidden
      const passwordContainer = container.querySelector('.max-h-0.opacity-0');
      expect(passwordContainer).toBeInTheDocument();
    });

    it('toggles password visibility when eye icon is clicked', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={true}
          createAccount={true}
          isPasswordVisible={false}
        />
      );

      // Act
      // Find the password input and its sibling button (eye icon)
      const passwordInput = screen.getByPlaceholderText('Min. 6 characters');
      const toggleButton = passwordInput.parentElement?.querySelector('button');

      if (toggleButton) {
        fireEvent.click(toggleButton);
      }

      // Assert
      expect(defaultProps.setIsPasswordVisible).toHaveBeenCalledWith(true);
    });

    it('renders password input as type password when isPasswordVisible is false', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={true}
          createAccount={true}
          isPasswordVisible={false}
        />
      );

      // Assert
      const input = screen.getByPlaceholderText('Min. 6 characters');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders password input as type text when isPasswordVisible is true', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={true}
          createAccount={true}
          isPasswordVisible={true}
        />
      );

      // Assert
      const input = screen.getByPlaceholderText('Min. 6 characters');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('calls setAccountPassword when password input changes', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          user={null}
          showPasswordInput={true}
          createAccount={true}
        />
      );

      // Act
      const input = screen.getByPlaceholderText('Min. 6 characters');
      fireEvent.change(input, { target: { value: 'test123' } });

      // Assert
      expect(defaultProps.setAccountPassword).toHaveBeenCalledTimes(1);
      expect(defaultProps.setAccountPassword).toHaveBeenCalledWith('test123');
    });
  });

  describe('Step Navigation', () => {
    it('calls setCurrentStep with contact when header is clicked', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          currentStep="delivery"
        />
      );

      // Act
      const headerButton = screen.getByRole('button', { name: /Contact Information/i });
      fireEvent.click(headerButton);

      // Assert
      expect(defaultProps.setCurrentStep).toHaveBeenCalledWith('contact');
    });
  });

  describe('Edge Cases', () => {
    it('handles whitespace-only first name as invalid', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          firstName="   "
        />
      );

      // Assert
      expect(screen.getByText('First name is required')).toBeInTheDocument();
    });

    it('handles whitespace-only last name as invalid', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          lastName="   "
        />
      );

      // Assert
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
    });

    it('handles whitespace-only email as invalid', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerEmail="   "
        />
      );

      // Assert
      expect(screen.getByText('Email address is required')).toBeInTheDocument();
    });

    it('validates email with proper format', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          customerEmail="test@example.com"
        />
      );

      // Assert
      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });

    it('calls setCompletedSteps with function updater', () => {
      // Arrange
      render(<ContactStep {...defaultProps} isContactValid={true} />);

      // Act
      const button = screen.getByRole('button', { name: /Continue to Delivery/i });
      fireEvent.click(button);

      // Assert
      expect(defaultProps.setCompletedSteps).toHaveBeenCalledWith(expect.any(Function));

      // Test the updater function
      const updaterFn = defaultProps.setCompletedSteps.mock.calls[0][0] as (prev: { contact: boolean; delivery: boolean }) => { contact: boolean; delivery: boolean };
      const result = updaterFn({ contact: false, delivery: false });
      expect(result).toEqual({ contact: true, delivery: false });
    });

    it('applies correct border styling when validation fails', () => {
      // Arrange
      render(
        <ContactStep
          {...defaultProps}
          contactValidationAttempted={true}
          firstName=""
        />
      );

      // Assert
      const input = screen.getByPlaceholderText('John');
      expect(input).toHaveClass('border-red-500');
    });
  });
});
