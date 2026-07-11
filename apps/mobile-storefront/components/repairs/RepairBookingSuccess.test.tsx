import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

import { RepairBookingSuccess } from './RepairBookingSuccess';

describe('RepairBookingSuccess', () => {
  const onDone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the ticket number and a confirmation message', () => {
    render(<RepairBookingSuccess ticketNumber={1234} onDone={onDone} />);

    expect(screen.getByText('#1234')).toBeTruthy();
    expect(screen.getByText(/Repair request received/i)).toBeTruthy();
  });

  it('calls onDone when the done button is pressed', () => {
    render(<RepairBookingSuccess ticketNumber={1234} onDone={onDone} />);

    fireEvent.press(screen.getByLabelText('Done'));

    expect(onDone).toHaveBeenCalled();
  });
});
