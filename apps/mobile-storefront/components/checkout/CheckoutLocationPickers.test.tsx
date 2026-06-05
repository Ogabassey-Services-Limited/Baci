import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { CheckoutLocationPickers } from './CheckoutLocationPickers';

function renderCityPicker({
  citySearch = '',
  onChangeCitySearch = jest.fn(),
  onSelectCity = jest.fn(),
  shippingCities = ['Ikeja', 'Lekki'],
}: {
  citySearch?: string;
  onChangeCitySearch?: (value: string) => void;
  onSelectCity?: (city: string) => void;
  shippingCities?: string[];
} = {}) {
  render(
    <CheckoutLocationPickers
      citySearch={citySearch}
      citySearchFocused={false}
      colors={Colors.light}
      isDark={false}
      onChangeCitySearch={onChangeCitySearch}
      onCloseCityPicker={jest.fn()}
      onCloseStatePicker={jest.fn()}
      onSelectCity={onSelectCity}
      onSelectState={jest.fn()}
      onSetCitySearchFocused={jest.fn()}
      removeClippedSubviews={false}
      shippingCities={shippingCities}
      shippingStates={['Lagos']}
      showCityPicker
      showStatePicker={false}
      watchedCity=""
      watchedState="Lagos"
    />
  );
}

describe('CheckoutLocationPickers', () => {
  it('lets customers select a typed city when it is not in the suggestions', () => {
    const onSelectCity = jest.fn();

    renderCityPicker({ citySearch: 'Airport Road', onSelectCity });

    fireEvent.press(
      screen.getByRole('button', { name: 'Use Airport Road as city' })
    );

    expect(onSelectCity).toHaveBeenCalledWith('Airport Road');
  });

  it('submits the typed city from the keyboard done action', () => {
    const onSelectCity = jest.fn();

    renderCityPicker({ citySearch: 'Gwarinpa', onSelectCity });

    fireEvent(
      screen.getByPlaceholderText('Search or type your city...'),
      'submitEditing'
    );

    expect(onSelectCity).toHaveBeenCalledWith('Gwarinpa');
  });

  it('submits the canonical suggestion casing from the keyboard done action', () => {
    const onSelectCity = jest.fn();

    renderCityPicker({ citySearch: 'ikeja', onSelectCity });

    fireEvent(
      screen.getByPlaceholderText('Search or type your city...'),
      'submitEditing'
    );

    expect(onSelectCity).toHaveBeenCalledWith('Ikeja');
  });

  it('does not duplicate the custom city action for an exact suggestion match', () => {
    renderCityPicker({ citySearch: 'Ikeja' });

    expect(
      screen.queryByRole('button', { name: 'Use Ikeja as city' })
    ).toBeNull();
    expect(screen.getByText('Ikeja')).toBeTruthy();
  });

  it('filters city suggestions using trimmed typed city text', () => {
    renderCityPicker({ citySearch: 'Ikeja ' });

    expect(screen.getByText('Ikeja')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Use Ikeja as city' })
    ).toBeNull();
  });
});
