import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import { FilterBarActiveControls } from './FilterBarActiveControls';

jest.mock('@react-native-vector-icons/feather', () => () => null);
jest.mock('@react-native-vector-icons/ionicons', () => () => null);

describe('FilterBarActiveControls', () => {
  const maxPriceCeiling = 3_000_000;
  const defaultProps = {
    minPrice: 0,
    maxPrice: maxPriceCeiling,
    onPriceChange: jest.fn(),
    brands: ['Apple'],
    selectedBrand: 'All',
    onSelectBrand: jest.fn(),
    selectedCondition: 'All',
    onSelectCondition: jest.fn(),
    minRating: 0,
    onSelectRating: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderControls(
    props: Partial<ComponentProps<typeof FilterBarActiveControls>> &
      Pick<ComponentProps<typeof FilterBarActiveControls>, 'activeFilterType'>
  ) {
    return render(
      <FilterBarActiveControls
        {...defaultProps}
        {...props}
      />
    );
  }

  it('selects a brand from the active brand controls', () => {
    const onSelectBrand = jest.fn();

    renderControls({ activeFilterType: 'brand', onSelectBrand });

    fireEvent.press(screen.getByRole('button', { name: 'Apple' }));

    expect(onSelectBrand).toHaveBeenCalledWith('Apple');
  });

  it('commits numeric price bounds on blur', () => {
    const onPriceChange = jest.fn();
    renderControls({ activeFilterType: 'price', onPriceChange });

    fireEvent.changeText(screen.getByRole('spinbutton', { name: 'Min' }), '5000');
    fireEvent.changeText(
      screen.getByRole('spinbutton', { name: 'Max' }),
      '125000'
    );
    fireEvent(screen.getByRole('spinbutton', { name: 'Max' }), 'blur');

    expect(onPriceChange).toHaveBeenCalledWith(5000, 125000);
  });

  it('normalizes invalid and empty price bounds on blur', () => {
    const onPriceChange = jest.fn();
    renderControls({ activeFilterType: 'price', onPriceChange });
    const minInput = screen.getByRole('spinbutton', { name: 'Min' });
    const maxInput = screen.getByRole('spinbutton', { name: 'Max' });

    fireEvent.changeText(minInput, 'abc');
    fireEvent.changeText(maxInput, '');
    fireEvent(maxInput, 'blur');

    expect(onPriceChange).toHaveBeenCalledWith(0, maxPriceCeiling);
    expect(minInput).toHaveProp('value', '');
    expect(maxInput).toHaveProp('value', '');
  });

  it('clamps negative and over-ceiling price bounds on blur', () => {
    const onPriceChange = jest.fn();
    renderControls({ activeFilterType: 'price', onPriceChange });
    const minInput = screen.getByRole('spinbutton', { name: 'Min' });
    const maxInput = screen.getByRole('spinbutton', { name: 'Max' });

    fireEvent.changeText(minInput, '-50');
    fireEvent.changeText(maxInput, '3000001');
    fireEvent(maxInput, 'blur');

    expect(onPriceChange).toHaveBeenCalledWith(0, maxPriceCeiling);
    expect(minInput).toHaveProp('value', '');
    expect(maxInput).toHaveProp('value', '');
  });

  it('commits price boundary values on blur', () => {
    const onPriceChange = jest.fn();
    renderControls({ activeFilterType: 'price', onPriceChange });

    fireEvent.changeText(screen.getByRole('spinbutton', { name: 'Min' }), '0');
    fireEvent.changeText(
      screen.getByRole('spinbutton', { name: 'Max' }),
      maxPriceCeiling.toString()
    );
    fireEvent(screen.getByRole('spinbutton', { name: 'Max' }), 'blur');

    expect(onPriceChange).toHaveBeenCalledWith(0, maxPriceCeiling);
  });

  it('syncs price input state when price props change', () => {
    const { rerender } = renderControls({
      activeFilterType: 'price',
      minPrice: 5000,
      maxPrice: 125000,
    });

    expect(screen.getByRole('spinbutton', { name: 'Min' })).toHaveProp(
      'value',
      '5000'
    );
    expect(screen.getByRole('spinbutton', { name: 'Max' })).toHaveProp(
      'value',
      '125000'
    );

    rerender(
      <FilterBarActiveControls
        activeFilterType="price"
        {...defaultProps}
        minPrice={2500}
        maxPrice={maxPriceCeiling}
      />
    );

    expect(screen.getByRole('spinbutton', { name: 'Min' })).toHaveProp(
      'value',
      '2500'
    );
    expect(screen.getByRole('spinbutton', { name: 'Max' })).toHaveProp(
      'value',
      ''
    );
  });

  it('renders a single All brand option when no brands are available', () => {
    renderControls({ activeFilterType: 'brand', brands: [] });

    expect(screen.getAllByRole('button', { name: 'All' })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Apple' })).toBeNull();
  });

  it('dedupes All from incoming brand options', () => {
    const onSelectBrand = jest.fn();
    renderControls({
      activeFilterType: 'brand',
      brands: ['All', 'Apple'],
      onSelectBrand,
    });

    expect(screen.getAllByRole('button', { name: 'All' })).toHaveLength(1);

    fireEvent.press(screen.getByRole('button', { name: 'Apple' }));

    expect(onSelectBrand).toHaveBeenCalledTimes(1);
    expect(onSelectBrand).toHaveBeenCalledWith('Apple');
  });

  it('selects a condition from the active condition controls', () => {
    const onSelectCondition = jest.fn();
    renderControls({ activeFilterType: 'condition', onSelectCondition });

    fireEvent.press(screen.getByRole('button', { name: 'New' }));

    expect(onSelectCondition).toHaveBeenCalledWith('New');
  });

  it('reports rapid condition toggles in the order pressed', () => {
    const onSelectCondition = jest.fn();
    renderControls({ activeFilterType: 'condition', onSelectCondition });

    fireEvent.press(screen.getByRole('button', { name: 'New' }));
    fireEvent.press(screen.getByRole('button', { name: 'Used' }));
    fireEvent.press(screen.getByRole('button', { name: 'All' }));

    expect(onSelectCondition).toHaveBeenNthCalledWith(1, 'New');
    expect(onSelectCondition).toHaveBeenNthCalledWith(2, 'Used');
    expect(onSelectCondition).toHaveBeenNthCalledWith(3, 'All');
  });

  it('deselects an active rating and clears rating with Any', () => {
    const onSelectRating = jest.fn();
    renderControls({
      activeFilterType: 'rating',
      minRating: 4,
      onSelectRating,
    });

    fireEvent.press(screen.getByRole('button', { name: '4+' }));
    fireEvent.press(screen.getByRole('button', { name: 'Any' }));

    expect(onSelectRating).toHaveBeenNthCalledWith(1, 0);
    expect(onSelectRating).toHaveBeenNthCalledWith(2, 0);
  });

  it('reports rapid rating toggles in the order pressed', () => {
    const onSelectRating = jest.fn();
    renderControls({ activeFilterType: 'rating', onSelectRating });

    fireEvent.press(screen.getByRole('button', { name: '4+' }));
    fireEvent.press(screen.getByRole('button', { name: '3+' }));
    fireEvent.press(screen.getByRole('button', { name: 'Any' }));

    expect(onSelectRating).toHaveBeenNthCalledWith(1, 4);
    expect(onSelectRating).toHaveBeenNthCalledWith(2, 3);
    expect(onSelectRating).toHaveBeenNthCalledWith(3, 0);
  });
});
