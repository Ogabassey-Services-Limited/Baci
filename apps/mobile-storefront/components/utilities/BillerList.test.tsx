import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BillerList } from './BillerList';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

const billers = [
  {
    billerId: 'ekedc',
    billerName: 'EKEDC NG',
    billerType: 'Electricity',
    categoryId: 'electricity',
    categoryName: 'Electricity',
  },
  {
    billerId: 'ikedc',
    billerName: 'IKEDC NG',
    billerType: 'Electricity',
    categoryId: 'electricity',
    categoryName: 'Electricity',
  },
];

describe('BillerList', () => {
  it('collapses to the selected provider and exposes a change action', () => {
    const onChangeSelection = jest.fn();

    render(
      <BillerList
        billers={billers}
        selectedBillerId="ekedc"
        onSelect={jest.fn()}
        isLoading={false}
        isCollapsed={true}
        onChangeSelection={onChangeSelection}
      />
    );

    expect(screen.getByText('EKEDC NG')).toBeTruthy();
    expect(screen.queryByText('IKEDC NG')).toBeNull();

    fireEvent.press(screen.getByLabelText('Change selected provider'));

    expect(onChangeSelection).toHaveBeenCalledTimes(1);
  });

  it('shows all providers while the picker is expanded', () => {
    render(
      <BillerList
        billers={billers}
        selectedBillerId="ekedc"
        onSelect={jest.fn()}
        isLoading={false}
      />
    );

    expect(screen.getByText('EKEDC NG')).toBeTruthy();
    expect(screen.getByText('IKEDC NG')).toBeTruthy();
  });
});
