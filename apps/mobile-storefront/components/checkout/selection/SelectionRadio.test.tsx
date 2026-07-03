import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import Colors from '@/constants/Colors';
import { SelectionRadio } from './SelectionRadio';

const colors = Colors.dark;

describe('SelectionRadio', () => {
  it('shows the filled dot only when selected', () => {
    const { rerender } = render(
      <SelectionRadio selected={false} colors={colors} />
    );
    expect(screen.queryByTestId('selection-radio-dot')).toBeNull();

    rerender(<SelectionRadio selected colors={colors} />);
    expect(screen.getByTestId('selection-radio-dot')).toBeTruthy();
  });

  it('renders a circle sized to the requested diameter', () => {
    render(<SelectionRadio selected={false} colors={colors} size={20} />);
    const ring = StyleSheet.flatten(
      screen.getByTestId('selection-radio').props.style
    );
    expect(ring.width).toBe(20);
    expect(ring.borderRadius).toBe(10);
  });
});
