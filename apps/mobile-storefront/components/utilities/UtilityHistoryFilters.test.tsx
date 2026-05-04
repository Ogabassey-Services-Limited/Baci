import { jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import UtilityHistoryFilters from './UtilityHistoryFilters';

describe('UtilityHistoryFilters', () => {
  it('marks the selected filter and forwards selection changes', () => {
    const setSelectedFilter = jest.fn();

    render(
      <UtilityHistoryFilters
        colors={Colors.light}
        selectedFilter="airtime"
        setSelectedFilter={setSelectedFilter}
      />
    );

    expect(screen.getByLabelText('Show airtime history')).toBeSelected();
    expect(screen.getByLabelText('Show data history')).not.toBeSelected();

    fireEvent.press(screen.getByLabelText('Show data history'));

    expect(setSelectedFilter).toHaveBeenCalledWith('data');
  });
});
