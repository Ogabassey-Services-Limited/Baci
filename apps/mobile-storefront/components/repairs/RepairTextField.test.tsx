import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

import { RepairTextField } from './RepairTextField';

describe('RepairTextField', () => {
  const onChangeText = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders its label and value and forwards changes', () => {
    render(
      <RepairTextField
        label="Full name"
        value="Ada"
        onChangeText={onChangeText}
      />
    );

    const input = screen.getByLabelText('Full name');
    expect(input.props.value).toBe('Ada');

    fireEvent.changeText(input, 'Ada Lovelace');
    expect(onChangeText).toHaveBeenCalledWith('Ada Lovelace');
  });

  it('renders an error message when provided', () => {
    render(
      <RepairTextField
        label="Email"
        value=""
        onChangeText={onChangeText}
        error="Enter a valid email address."
      />
    );

    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
  });

  it('does not render an error row when there is no error', () => {
    render(
      <RepairTextField label="Phone" value="" onChangeText={onChangeText} />
    );

    expect(screen.queryByText(/valid/i)).toBeNull();
  });
});
