import { IMEI_SERVICE_TIERS } from '@baci/shared/imei';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { ImeiCheckServiceSelector } from './imei-check-service-selector';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const baseProps = {
  colors: Colors.light,
  currentTier: IMEI_SERVICE_TIERS.full,
  displayedTierKeys: ['full', 'blacklist', 'carrier'] as const,
  selectedBrand: 'all' as const,
  selectedTier: 'full' as const,
  canToggleServices: true,
  showAllServices: false,
  onBrandSelect: jest.fn(),
  onTierSelect: jest.fn(),
  onToggleServices: jest.fn(),
};

describe('ImeiCheckServiceSelector', () => {
  it('renders the section header with the current tier name and price', () => {
    render(<ImeiCheckServiceSelector {...baseProps} />);

    expect(screen.getByText('Report type')).toBeTruthy();
    expect(screen.getByText('Full Report - ₦1,500')).toBeTruthy();
  });

  it('renders all brand chips and the displayed tier cards', () => {
    render(<ImeiCheckServiceSelector {...baseProps} />);

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Samsung')).toBeTruthy();
    expect(screen.getByText('Android')).toBeTruthy();

    expect(screen.getByText('Full Report')).toBeTruthy();
    expect(screen.getByText('Stolen Check')).toBeTruthy();
    expect(screen.getByText('Network Check')).toBeTruthy();
  });

  it('calls onBrandSelect with the chip identifier when a brand is pressed', () => {
    const onBrandSelect = jest.fn();
    render(
      <ImeiCheckServiceSelector {...baseProps} onBrandSelect={onBrandSelect} />
    );

    fireEvent.press(screen.getByText('Samsung'));

    expect(onBrandSelect).toHaveBeenCalledWith('samsung');
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
