import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiRemediationCurrencyOption } from './imei-remediation-currency-option';

describe('ImeiRemediationCurrencyOption', () => {
  it('exposes radio state and selects the currency', () => {
    const onSelect = jest.fn();
    render(
      <ImeiRemediationCurrencyOption
        checked
        colors={Colors.light}
        label="65.00 USDT"
        onSelect={onSelect}
      />
    );

    const option = screen.getByRole('radio', { name: '65.00 USDT' });
    expect(option).toHaveAccessibilityState({ checked: true });
    fireEvent.press(option);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
