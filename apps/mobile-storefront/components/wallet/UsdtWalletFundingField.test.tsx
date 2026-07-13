import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { UsdtWalletFundingField } from './UsdtWalletFundingField';

describe('UsdtWalletFundingField', () => {
  it('labels and forwards text input changes', () => {
    const onChange = jest.fn();
    render(
      <UsdtWalletFundingField
        colors={Colors.light}
        label="City"
        onChange={onChange}
        value=""
      />
    );

    fireEvent.changeText(screen.getByLabelText('City'), 'Lagos');
    expect(onChange).toHaveBeenCalledWith('Lagos');
  });
});
