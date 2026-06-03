import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { SearchOverlayEmptyState } from './SearchOverlayEmptyState';

jest.mock('react-native-reanimated', () => {
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    __esModule: true,
    default: {
      ScrollView: RN.ScrollView,
    },
    FadeIn: { delay: () => ({}) },
  };
});

describe('SearchOverlayEmptyState', () => {
  it('renders recent searches and clears history', () => {
    const onClearHistory = jest.fn();
    const onSuggestionPress = jest.fn();

    render(
      <SearchOverlayEmptyState
        categories={[]}
        colors={Colors.light}
        onCategoryPress={jest.fn()}
        onClearHistory={onClearHistory}
        onSuggestionPress={onSuggestionPress}
        recentSearches={['shoes']}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Search for shoes' }));
    fireEvent.press(
      screen.getByRole('button', { name: 'Clear recent searches' })
    );

    expect(onSuggestionPress).toHaveBeenCalledWith('shoes');
    expect(onClearHistory).toHaveBeenCalled();
  });

  it('renders category shortcuts', () => {
    const onCategoryPress = jest.fn();

    render(
      <SearchOverlayEmptyState
        categories={[{ id: 'cat-1', name: 'Phones', slug: 'phones' }]}
        colors={Colors.light}
        onCategoryPress={onCategoryPress}
        onClearHistory={jest.fn()}
        onSuggestionPress={jest.fn()}
        recentSearches={[]}
      />
    );

    fireEvent.press(
      screen.getByRole('button', { name: 'Explore category Phones' })
    );

    expect(onCategoryPress).toHaveBeenCalledWith('phones');
  });
});
