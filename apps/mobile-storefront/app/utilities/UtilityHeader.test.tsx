import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { UtilityHeader } from './UtilityHeader';

function renderHeader(
  overrides: Partial<{
    onBack: () => void;
    onHistory: () => void;
    title: string;
  }> = {}
) {
  const props = {
    dividerColor: Colors.light.border,
    iconBackgroundColor: Colors.light.card,
    iconColor: Colors.light.text,
    onBack: jest.fn(),
    surfaceColor: Colors.light.background,
    title: 'Electricity',
    titleColor: Colors.light.text,
    topInset: 24,
    ...overrides,
  };

  render(<UtilityHeader {...props} />);

  return props;
}

describe('UtilityHeader', () => {
  it('renders the title and back button', () => {
    const props = renderHeader();

    expect(screen.getByText('Electricity')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the history action when no handler is provided', () => {
    renderHeader();

    expect(screen.queryByLabelText('View utility history')).toBeNull();
  });

  it('renders the history action when a handler is provided', () => {
    const onHistory = jest.fn();
    renderHeader({ onHistory, title: 'Data' });

    fireEvent.press(screen.getByLabelText('View utility history'));

    expect(onHistory).toHaveBeenCalledTimes(1);
  });
});
