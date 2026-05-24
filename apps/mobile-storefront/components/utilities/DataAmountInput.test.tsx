import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { DataAmountInput } from './DataAmountInput';

describe('DataAmountInput', () => {
  it('updates manual amount input', () => {
    const onChangeAmount = jest.fn();

    render(
      <DataAmountInput
        amount={0}
        colors={Colors.light}
        isFixedAmount={false}
        onChangeAmount={onChangeAmount}
      />
    );

    fireEvent.changeText(screen.getByLabelText('Amount'), '3,500');

    expect(onChangeAmount).toHaveBeenCalledWith(3500);
  });

  it('locks the amount when the selected data package is fixed-price', () => {
    const onChangeAmount = jest.fn();

    render(
      <DataAmountInput
        amount={3500}
        colors={Colors.light}
        isFixedAmount={true}
        onChangeAmount={onChangeAmount}
      />
    );

    expect(screen.getByLabelText('Amount')).toHaveProp('editable', false);

    fireEvent.changeText(screen.getByLabelText('Amount'), '1000');

    expect(onChangeAmount).not.toHaveBeenCalled();
  });
});
