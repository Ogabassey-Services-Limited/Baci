import { render, screen } from '@testing-library/react-native';
import { PhoneInput } from './PhoneInput';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'dark',
}));

describe('PhoneInput', () => {
  it('uses the expected default placeholder when none is provided', () => {
    render(<PhoneInput value="" onChangeText={() => {}} />);

    expect(screen.getByPlaceholderText('8012345678')).toBeTruthy();
  });

  it('allows callers to override the placeholder', () => {
    render(
      <PhoneInput value="" onChangeText={() => {}} placeholder="8123456789" />
    );

    expect(screen.getByPlaceholderText('8123456789')).toBeTruthy();
    expect(screen.queryByPlaceholderText('8012345678')).toBeNull();
  });

  it('defaults the return key to next for chained form flows', () => {
    render(<PhoneInput value="" onChangeText={() => {}} />);

    expect(screen.getByLabelText('Phone number').props.returnKeyType).toBe(
      'next'
    );
  });

  it('allows callers to override the return key type', () => {
    render(
      <PhoneInput value="" onChangeText={() => {}} returnKeyType="done" />
    );

    expect(screen.getByLabelText('Phone number').props.returnKeyType).toBe(
      'done'
    );
  });
});
