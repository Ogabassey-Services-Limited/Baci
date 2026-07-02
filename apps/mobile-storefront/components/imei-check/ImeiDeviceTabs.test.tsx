import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiDeviceTabs } from './ImeiDeviceTabs';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

const baseProps = {
  colors: Colors.light,
  selected: 'smartphone' as const,
  onSelect: jest.fn(),
};

describe('ImeiDeviceTabs', () => {
  it('renders a tab for every device category', () => {
    render(<ImeiDeviceTabs {...baseProps} />);

    expect(screen.getByLabelText('Phone checks')).toBeTruthy();
    expect(screen.getByLabelText('iPad checks')).toBeTruthy();
    expect(screen.getByLabelText('Mac checks')).toBeTruthy();
    expect(screen.getByLabelText('Watch checks')).toBeTruthy();
  });

  it('marks the selected category and reports selection changes', () => {
    const onSelect = jest.fn();
    render(<ImeiDeviceTabs {...baseProps} onSelect={onSelect} />);

    const phoneTab = screen.getByLabelText('Phone checks');
    expect(phoneTab.props.accessibilityState.selected).toBe(true);

    fireEvent.press(screen.getByLabelText('Mac checks'));
    expect(onSelect).toHaveBeenCalledWith('laptop');
  });
});
