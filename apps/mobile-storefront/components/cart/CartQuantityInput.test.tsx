import { fireEvent, render, screen } from '@testing-library/react-native';
import CartQuantityInput from './CartQuantityInput';

describe('CartQuantityInput', () => {
  it('filters non-digit characters in onChangeText', () => {
    const onChange = jest.fn();

    render(<CartQuantityInput value={2} onChange={onChange} />);

    const input = screen.getByLabelText('Quantity input');
    fireEvent.changeText(input, 'a1b2c');

    expect(screen.getByDisplayValue('12')).toBeTruthy();
  });

  it('calls onChange on valid blur and resets to prop value on invalid blur', () => {
    const onChange = jest.fn();

    render(<CartQuantityInput value={3} onChange={onChange} />);

    const input = screen.getByLabelText('Quantity input');

    fireEvent.changeText(input, '15');
    fireEvent(input, 'blur');
    expect(onChange).toHaveBeenCalledWith(15);
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.changeText(input, '');
    fireEvent(input, 'blur');
    expect(screen.getByDisplayValue('3')).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);

    fireEvent.changeText(input, '0');
    fireEvent(input, 'blur');
    expect(screen.getByDisplayValue('3')).toBeTruthy();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('syncs local input value when external value prop changes', () => {
    const onChange = jest.fn();
    const { rerender } = render(<CartQuantityInput value={1} onChange={onChange} />);

    expect(screen.getByDisplayValue('1')).toBeTruthy();

    rerender(<CartQuantityInput value={7} onChange={onChange} />);

    expect(screen.getByDisplayValue('7')).toBeTruthy();
  });
});
