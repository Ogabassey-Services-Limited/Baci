import { fireEvent, render, screen } from '@testing-library/react-native';
import { CheckoutGuestSaveDetails } from './CheckoutGuestSaveDetails';

const mockColors = {
  border: '#d1d5db',
  card: '#ffffff',
  error: '#dc2626',
  text: '#111827',
  textSecondary: '#6b7280',
};

const baseProps = {
  accountPassword: '',
  colors: mockColors,
  onChangeAccountPassword: jest.fn(),
  onToggleSaveDetails: jest.fn(),
  saveDetails: false,
};

describe('CheckoutGuestSaveDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders an unchecked save-details checkbox and toggles on press', () => {
    render(<CheckoutGuestSaveDetails {...baseProps} />);

    const checkbox = screen.getByRole('checkbox', {
      name: 'Save my details for faster checkout',
    });

    expect(checkbox.props.accessibilityState).toMatchObject({
      checked: false,
    });

    fireEvent.press(checkbox);

    expect(baseProps.onToggleSaveDetails).toHaveBeenCalledTimes(1);
  });

  it('renders account details when save-details is checked', () => {
    render(<CheckoutGuestSaveDetails {...baseProps} saveDetails />);

    expect(
      screen.getByRole('checkbox', {
        name: 'Save my details for faster checkout',
      }).props.accessibilityState
    ).toMatchObject({ checked: true });
    expect(screen.getByText(/This will create an account/i)).toBeTruthy();
    expect(screen.getByLabelText('Create a password')).toBeTruthy();
  });

  it('invokes the password change callback when the user types', () => {
    render(<CheckoutGuestSaveDetails {...baseProps} saveDetails />);

    fireEvent.changeText(
      screen.getByLabelText('Create a password'),
      'long-enough'
    );

    expect(baseProps.onChangeAccountPassword).toHaveBeenCalledWith(
      'long-enough'
    );
  });

  it('displays validation error when password is shorter than 6 characters', () => {
    render(
      <CheckoutGuestSaveDetails
        {...baseProps}
        accountPassword="short"
        saveDetails
      />
    );

    expect(
      screen.getByText('Password must be at least 6 characters')
    ).toBeTruthy();
  });
});
