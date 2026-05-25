import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterSheetPresets } from './FilterSheetPresets';

describe('FilterSheetPresets', () => {
  it('reports the selected quick price range', () => {
    const onSelectRange = jest.fn();

    render(
      <FilterSheetPresets
        colors={{
          border: '#E5E7EB',
          muted: '#F3F4F6',
          textSecondary: '#4B5563',
        }}
        onSelectRange={onSelectRange}
      />
    );

    fireEvent.press(screen.getByLabelText('Under 50,000 Naira'));

    expect(onSelectRange).toHaveBeenCalledWith('0', '50000');
  });
});
