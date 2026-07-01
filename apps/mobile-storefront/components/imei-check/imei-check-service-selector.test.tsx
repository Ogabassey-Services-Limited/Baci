import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckServiceSelector } from './imei-check-service-selector';

jest.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

const baseProps = {
  colors: Colors.light,
  displayedTierKeys: ['full', 'blacklist', 'carrier'] as const,
  selectedTier: 'full' as const,
  canToggleServices: true,
  showAllServices: false,
  onTierSelect: jest.fn(),
  onToggleServices: jest.fn(),
};

describe('ImeiCheckServiceSelector', () => {
  it('renders the displayed tier cards', () => {
    render(<ImeiCheckServiceSelector {...baseProps} />);

    expect(screen.getByText('Full Report')).toBeTruthy();
    expect(screen.getByText('Stolen Check')).toBeTruthy();
    expect(screen.getByText('Network Check')).toBeTruthy();
  });

  it('calls onTierSelect when a tier card is pressed', () => {
    const onTierSelect = jest.fn();
    render(
      <ImeiCheckServiceSelector {...baseProps} onTierSelect={onTierSelect} />
    );

    fireEvent.press(screen.getByText('Stolen Check'));

    expect(onTierSelect).toHaveBeenCalledWith('blacklist');
  });

  it('toggles the expand/collapse copy via onToggleServices', () => {
    const onToggleServices = jest.fn();
    const { rerender } = render(
      <ImeiCheckServiceSelector
        {...baseProps}
        onToggleServices={onToggleServices}
      />
    );

    expect(screen.getByText('Show all services')).toBeTruthy();
    fireEvent.press(screen.getByText('Show all services'));
    expect(onToggleServices).toHaveBeenCalledTimes(1);

    rerender(
      <ImeiCheckServiceSelector
        {...baseProps}
        showAllServices
        onToggleServices={onToggleServices}
      />
    );
    expect(screen.getByText('Show key checks')).toBeTruthy();
  });

  it('hides the expand control when there are no additional tiers', () => {
    render(
      <ImeiCheckServiceSelector {...baseProps} canToggleServices={false} />
    );

    expect(screen.queryByText('Show all services')).toBeNull();
    expect(screen.queryByText('Show key checks')).toBeNull();
  });
});
