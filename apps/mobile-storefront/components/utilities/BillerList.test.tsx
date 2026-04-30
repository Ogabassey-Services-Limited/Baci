import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BillerList } from '@/components/utilities/BillerList';
import type { Biller } from '@/hooks/use-vtu-billers';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

const billers: Biller[] = [
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
  it('shows a loading state while providers are loading', () => {
    render(
      <BillerList
        billers={[]}
        selectedBillerId={null}
        onSelect={jest.fn()}
        isLoading={true}
      />
    );

    expect(screen.getByText('Loading providers...')).toBeOnTheScreen();
  });

  it('shows an error message when provider loading fails', () => {
    render(
      <BillerList
        billers={[]}
        selectedBillerId={null}
        onSelect={jest.fn()}
        isLoading={false}
        errorMessage="Unable to load providers"
      />
    );

    expect(screen.getByText('Unable to load providers')).toBeOnTheScreen();
  });

  it('shows an empty message when no providers are available', () => {
    render(
      <BillerList
        billers={[]}
        selectedBillerId={null}
        onSelect={jest.fn()}
        isLoading={false}
        emptyMessage="No electricity providers available"
      />
    );

    expect(
      screen.getByText('No electricity providers available')
    ).toBeOnTheScreen();
  });

  it('collapses to the selected provider and exposes a change action', () => {
    const onChangeSelection = jest.fn();
    const selectedBillers: Biller[] = [
      {
        ...billers[0],
        billerIconUrl: 'https://example.com/ekedc.png',
      },
      billers[1],
    ];

    render(
      <BillerList
        billers={selectedBillers}
        selectedBillerId="ekedc"
        onSelect={jest.fn()}
        isLoading={false}
        isCollapsed={true}
        onChangeSelection={onChangeSelection}
      />
    );

    expect(screen.getByText('EKEDC NG')).toBeOnTheScreen();
    expect(screen.queryByText('IKEDC NG')).toBeNull();
    expect(screen.getByLabelText('EKEDC NG logo')).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText('Change selected provider'));

    expect(onChangeSelection).toHaveBeenCalledTimes(1);
  });

  it('shows a collapsed selection prompt when there is no selected provider', () => {
    const onChangeSelection = jest.fn();

    render(
      <BillerList
        billers={billers}
        selectedBillerId={null}
        onSelect={jest.fn()}
        isLoading={false}
        isCollapsed={true}
        onChangeSelection={onChangeSelection}
      />
    );

    expect(screen.getByText('Provider')).toBeOnTheScreen();
    expect(screen.getByText('Select provider')).toBeOnTheScreen();
    expect(screen.queryByText('EKEDC NG')).toBeNull();
    expect(screen.queryByText('IKEDC NG')).toBeNull();

    fireEvent.press(screen.getByLabelText('Select provider'));

    expect(onChangeSelection).toHaveBeenCalledTimes(1);
  });

  it('shows all providers while the picker is expanded', () => {
    render(
      <BillerList
        billers={billers}
        selectedBillerId="ekedc"
        onSelect={jest.fn()}
        isLoading={false}
        isCollapsed={false}
      />
    );

    expect(screen.getByText('EKEDC NG')).toBeOnTheScreen();
    expect(screen.getByText('IKEDC NG')).toBeOnTheScreen();
  });

  it('calls onSelect with the selected biller', () => {
    const onSelect = jest.fn();

    render(
      <BillerList
        billers={billers}
        selectedBillerId={null}
        onSelect={onSelect}
        isLoading={false}
        isCollapsed={false}
      />
    );

    fireEvent.press(screen.getByText('EKEDC NG'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ billerId: 'ekedc' })
    );
  });

  it('uses compact initial styling for collapsed providers without logos', () => {
    render(
      <BillerList
        billers={billers}
        selectedBillerId="ekedc"
        onSelect={jest.fn()}
        isLoading={false}
        isCollapsed={true}
      />
    );

    expect(screen.getByLabelText('Biller: EKEDC NG')).toHaveStyle({
      height: 32,
      width: 32,
    });
  });
});
