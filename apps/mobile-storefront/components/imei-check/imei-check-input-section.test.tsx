import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckInputSection } from './imei-check-input-section';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

const baseProps = {
  colors: Colors.light,
  error: null as string | null,
  identifier: 'imei' as const,
  imei: '',
  onChangeImei: jest.fn(),
  onCheck: jest.fn(),
  onClearImei: jest.fn(),
};

describe('ImeiCheckInputSection', () => {
  it('renders the placeholder input and digit counter at zero by default', () => {
    render(<ImeiCheckInputSection {...baseProps} />);

    // The label is intentionally omitted — the placeholder is the only prompt.
    expect(screen.getByText('0/15')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter 15-digit IMEI')).toBeTruthy();
  });

  it('updates the digit counter to reflect the current IMEI length', () => {
    render(<ImeiCheckInputSection {...baseProps} imei="123456789012345" />);

    expect(screen.getByText('15/15')).toBeTruthy();
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

  it('exposes an accessible clear action when an IMEI is present', () => {
    const onClearImei = jest.fn();
    render(
      <ImeiCheckInputSection
        {...baseProps}
        imei="358240051111110"
        onClearImei={onClearImei}
      />
    );

    fireEvent.press(screen.getByLabelText('Clear input'));

    expect(onClearImei).toHaveBeenCalledTimes(1);
  });
});
