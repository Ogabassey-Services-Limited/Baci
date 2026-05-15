import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckInputSection } from './imei-check-input-section';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const baseProps = {
  colors: Colors.light,
  error: null as string | null,
  imei: '',
  onChangeImei: jest.fn(),
  onCheck: jest.fn(),
  onClearImei: jest.fn(),
};

describe('ImeiCheckInputSection', () => {
  it('renders the labeled input and digit counter at zero by default', () => {
    render(<ImeiCheckInputSection {...baseProps} />);

    expect(screen.getByText('Enter 15-digit IMEI')).toBeTruthy();
    expect(screen.getByText('0/15 digits')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter 15-digit IMEI')).toBeTruthy();
  });

  it('updates the digit counter to reflect the current IMEI length', () => {
    render(<ImeiCheckInputSection {...baseProps} imei="123456789012345" />);

    expect(screen.getByText('15/15 digits')).toBeTruthy();
  });

  it('forwards keystrokes to onChangeImei', () => {
    const onChangeImei = jest.fn();
    render(
      <ImeiCheckInputSection {...baseProps} onChangeImei={onChangeImei} />
    );

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter 15-digit IMEI'),
      '358240051111110'
    );

    expect(onChangeImei).toHaveBeenCalledWith('358240051111110');
  });

  it('renders the error banner when an error is provided', () => {
    render(
      <ImeiCheckInputSection {...baseProps} error="That IMEI looks invalid." />
    );

    expect(screen.getByText('That IMEI looks invalid.')).toBeTruthy();
  });

  it('shows the help steps for finding the IMEI', () => {
    render(<ImeiCheckInputSection {...baseProps} />);

    expect(screen.getByText('How to find your IMEI')).toBeTruthy();
    expect(screen.getByText('*#06#')).toBeTruthy();
    expect(screen.getByText('Copy 15 digits')).toBeTruthy();
    expect(screen.getByText('Paste above')).toBeTruthy();
  });

  it('exposes an accessible clear action when an IMEI is present', () => {
    const onClearImei = jest.fn();
    render(
      <ImeiCheckInputSection
        {...baseProps}
        imei="358240051111110"
        onClearImei={onClearImei}
      />
    );

    fireEvent.press(screen.getByLabelText('Clear IMEI'));

    expect(onClearImei).toHaveBeenCalledTimes(1);
  });
});
