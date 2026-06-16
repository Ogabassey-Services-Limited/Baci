import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { PickerHeader } from './PickerHeader';

jest.mock('@react-native-vector-icons/ionicons', () => () => null);

describe('PickerHeader', () => {
  it('renders the title and closes from the accessible close button', () => {
    const onClose = jest.fn();

    render(
      <PickerHeader
        colors={Colors.light}
        onClose={onClose}
        title="Select City"
      />
    );

    expect(screen.getByText('Select City')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: 'Close Select City picker' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
