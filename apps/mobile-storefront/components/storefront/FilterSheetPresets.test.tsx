import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterSheetPresets } from './FilterSheetPresets';

const colors = {
  border: '#E5E7EB',
  muted: '#F3F4F6',
  textSecondary: '#4B5563',
};

describe('FilterSheetPresets', () => {
  it('does not report a selected range before interaction', () => {
    const onSelectRange = jest.fn();

    render(
      <FilterSheetPresets colors={colors} onSelectRange={onSelectRange} />
    );

    expect(onSelectRange).not.toHaveBeenCalled();
  });

  it.each([
    ['Under 50,000 Naira', '0', '50000'],
    ['50,000 to 150,000 Naira', '50000', '150000'],
    ['150,000 to 300,000 Naira', '150000', '300000'],
    ['Above 300,000 Naira', '300000', '3000000'],
  ])('reports selected range for %s', (label, min, max) => {
    const onSelectRange = jest.fn();

    render(
      <FilterSheetPresets colors={colors} onSelectRange={onSelectRange} />
    );

    fireEvent.press(screen.getByLabelText(label));

    expect(onSelectRange).toHaveBeenCalledWith(min, max);
  });

  it('reports the selected quick price range', () => {
    const onSelectRange = jest.fn();

    render(
      <FilterSheetPresets colors={colors} onSelectRange={onSelectRange} />
    );

    fireEvent.press(screen.getByLabelText('Under 50,000 Naira'));

    expect(onSelectRange).toHaveBeenCalledWith('0', '50000');
  });
});
