import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckPending } from './imei-check-pending';

describe('ImeiCheckPending', () => {
  it('announces active async processing', () => {
    render(<ImeiCheckPending colors={Colors.light} paused={false} />);

    expect(screen.getByText(/usually under a minute/i)).toBeTruthy();
  });

  it('explains that processing continues after foreground polling stops', () => {
    render(<ImeiCheckPending colors={Colors.light} paused />);

    expect(screen.getByText(/check back later/i)).toBeTruthy();
  });
});
