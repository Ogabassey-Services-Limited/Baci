import { fireEvent, render, screen } from '@testing-library/react-native';
import { SearchDropdown } from './SearchDropdown';

const mockPush = jest.fn();
const mockUseProducts = jest.fn();
const mockUseCategories = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks', () => ({
  useCategories: () => mockUseCategories(),
  useDebounce: (value: string) => value,
  useProducts: (args: unknown) => mockUseProducts(args),
}));

jest.mock('@/hooks/use-search-storage', () => ({
  useSearchStorage: () => ({
    clearHistory: jest.fn(),
    recentSearches: [],
    saveSearch: jest.fn(),
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/components/ui/SafeImage', () => ({
  SafeImage: () => null,
}));

describe('SearchDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProducts.mockReturnValue({ isLoading: false, products: [] });
    mockUseCategories.mockReturnValue({ data: [] });
  });

  it('renders nothing when hidden', () => {
    const { queryByLabelText } = render(
      <SearchDropdown isVisible={false} onClose={() => {}} topOffset={72} />
    );

    expect(queryByLabelText('Close search')).toBeNull();
  });

  it('renders search controls when visible', () => {
    render(<SearchDropdown isVisible onClose={() => {}} topOffset={72} />);

    expect(screen.getByPlaceholderText('Search products...')).toBeTruthy();
    expect(screen.getByLabelText('Cancel search')).toBeTruthy();
  });

  it('calls onClose when scrim is pressed', () => {
    const onClose = jest.fn();

    render(<SearchDropdown isVisible onClose={onClose} topOffset={72} />);

    fireEvent.press(screen.getByLabelText('Close search'));
    expect(onClose).toHaveBeenCalled();
  });
});
