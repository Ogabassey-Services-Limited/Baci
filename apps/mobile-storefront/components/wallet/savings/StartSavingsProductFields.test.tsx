import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { StartSavingsProductFields } from './StartSavingsProductFields';
import type { StartSavingsController } from './start-savings-controller.types';

type MockDateTimePickerProps = {
  mode: 'date' | 'time';
  onChange: (event: { type: 'set' }, date: Date) => void;
};

// Keep picker output deterministic: the time fixture proves HH:mm formatting,
// while the next-day date fixture proves date selection updates independently.
jest.mock('@react-native-community/datetimepicker', () => {
  return {
    __esModule: true,
    default: ({ mode, onChange }: MockDateTimePickerProps) => {
      const { Pressable, Text } = jest.requireActual(
        'react-native'
      ) as typeof import('react-native');

      return (
        <Pressable
          accessibilityLabel={`Mock ${mode} picker`}
          accessibilityRole="button"
          onPress={() =>
            onChange(
              { type: 'set' },
              mode === 'time'
                ? new Date(2026, 4, 22, 7, 0)
                : new Date(2026, 4, 23)
            )
          }
        >
          <Text>{`${mode} picker`}</Text>
        </Pressable>
      );
    },
  };
});

function createController(
  overrides: Partial<StartSavingsController> = {}
): StartSavingsController {
  return {
    debouncedSearch: 'iphone',
    frequency: 'daily',
    isProductsLoading: false,
    preferredDebitTime: '06:20',
    products: [
      {
        condition: 'Used',
        id: 'product-1',
        image: 'https://cdn.example.com/iphone.jpg',
        name: 'iPhone 13 Pro Max',
        price: 800000,
        slug: 'iphone-13-pro-max',
        variant_attributes: { storage: ['128GB', '256GB'] },
      },
    ],
    searchValue: 'iphone',
    selectProduct: jest.fn(),
    selectedProduct: null,
    setFrequency: jest.fn(),
    setPreferredDebitTime: jest.fn(),
    setSearchValue: jest.fn(),
    setStartDate: jest.fn(),
    setTargetAmount: jest.fn(),
    startDate: '2026-05-22',
    targetAmount: '',
    ...overrides,
  } as StartSavingsController;
}

describe('StartSavingsProductFields', () => {
  it('searches and selects product suggestions', () => {
    const controller = createController();
    render(
      <StartSavingsProductFields
        colors={Colors.light}
        controller={controller}
      />
    );

    fireEvent.changeText(
      screen.getByRole('search', { name: 'Savings product search' }),
      'iphone 13'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Select iPhone 13 Pro Max' })
    );

    expect(controller.setSearchValue).toHaveBeenCalledWith('iphone 13');
    expect(screen.getByText('Used · Storage: 128GB / 256GB')).toBeOnTheScreen();
    expect(controller.selectProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-1' })
    );
  });

  it('updates target amount, frequency, debit time, and start date', () => {
    const controller = createController({
      selectedProduct: {
        conditionLabel: 'Used',
        id: 'product-1',
        image: 'https://cdn.example.com/iphone.jpg',
        name: 'iPhone 13 Pro Max',
        price: 800000,
        slug: 'iphone-13-pro-max',
        variantLabel: 'Storage: 256GB',
      },
    });
    render(
      <StartSavingsProductFields
        colors={Colors.light}
        controller={controller}
      />
    );

    fireEvent.changeText(
      screen.getByLabelText('Savings target amount'),
      '800000'
    );
    fireEvent.press(
      screen.getByRole('button', { name: 'Choose weekly savings frequency' })
    );
    fireEvent.press(screen.getByRole('button', { name: 'Savings debit time' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock time picker' }));
    fireEvent.press(screen.getByRole('button', { name: 'Savings start date' }));
    fireEvent.press(screen.getByRole('button', { name: 'Mock date picker' }));

    expect(screen.getByText('Selected product')).toBeOnTheScreen();
    expect(screen.getByText('Used · Storage: 256GB')).toBeOnTheScreen();
    expect(controller.setTargetAmount).toHaveBeenCalledWith('800000');
    expect(controller.setFrequency).toHaveBeenCalledWith('weekly');
    expect(controller.setPreferredDebitTime).toHaveBeenCalledWith('07:00');
    expect(controller.setStartDate).toHaveBeenCalledWith('2026-05-23');
  });

  it('shows a loading state while product suggestions are loading', () => {
    render(
      <StartSavingsProductFields
        colors={Colors.light}
        controller={createController({ isProductsLoading: true, products: [] })}
      />
    );

    expect(screen.getByLabelText('Loading savings products')).toBeOnTheScreen();
  });

  it('shows an empty state when search has no product matches', () => {
    render(
      <StartSavingsProductFields
        colors={Colors.light}
        controller={createController({ products: [] })}
      />
    );

    expect(screen.getByText('No matching products found.')).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: /Select /i })
    ).not.toBeOnTheScreen();
  });
});
