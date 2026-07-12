import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { AddressPredictionRow } from './AddressPredictionRow';

const prediction = {
  description: '1 Allen Avenue, Ikeja, Lagos',
  mainText: '1 Allen Avenue',
  placeId: 'place-1',
  secondaryText: 'Ikeja, Lagos',
};

describe('AddressPredictionRow', () => {
  it('announces and selects the rendered prediction', () => {
    const onSelect = jest.fn();
    render(
      <AddressPredictionRow
        colors={Colors.light}
        isDark={false}
        onSelect={onSelect}
        prediction={prediction}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: '1 Allen Avenue, Ikeja, Lagos',
      })
    );

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(prediction);
  });

  it('selects a prediction whose secondary display text is empty', () => {
    const onSelect = jest.fn();
    const predictionWithoutSecondaryText = {
      ...prediction,
      secondaryText: '',
    };
    render(
      <AddressPredictionRow
        colors={Colors.light}
        isDark={false}
        onSelect={onSelect}
        prediction={predictionWithoutSecondaryText}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: '1 Allen Avenue, ' })
    );

    expect(onSelect).toHaveBeenCalledWith(predictionWithoutSecondaryText);
  });
});
