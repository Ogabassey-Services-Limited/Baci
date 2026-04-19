import { fireEvent, render, screen } from '@testing-library/react-native';
import { Header } from './Header';

const mockOpenDrawer = jest.fn();

jest.mock('expo-constants', () => ({
  expoConfig: { name: 'Ogabassey' },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/Logo', () => ({
  Logo: () => null,
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#111111',
      textSecondary: '#666666',
      foreground: '#111111',
      muted: '#f2f2f2',
      placeholder: '#999999',
      icon: '#444444',
      card: '#ffffff',
      border: '#dddddd',
      background: '#ffffff',
    },
  }),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    BUSINESS_TYPE: 'electronics',
    TEMPLATE_ID: 'ogabassey',
  },
}));

jest.mock('@/lib/seasonal', () => ({
  SEASONAL: {
    shouldShowSanta: () => false,
    getTokens: () => ({}),
  },
}));

jest.mock('@/lib/templates', () => ({
  getTemplateConfig: () => ({
    headerStyle: 'elite',
    features: {},
  }),
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { itemCount: () => number }) => unknown) =>
    selector({ itemCount: () => 0 }),
}));

jest.mock('@/stores/drawer-store', () => ({
  useDrawerStore: (
    selector: (state: { openDrawer: typeof mockOpenDrawer }) => unknown
  ) => selector({ openDrawer: mockOpenDrawer }),
}));

jest.mock('@/stores/theme-store', () => ({
  useThemeStore: (selector: (state: { theme: string }) => unknown) =>
    selector({ theme: 'default' }),
}));

describe('Header search behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the provided search handler when the search trigger is pressed', () => {
    const onSearchPress = jest.fn();

    render(<Header onSearchPress={onSearchPress} showSearch />);

    fireEvent.press(
      screen.getByLabelText('Search products, brands and categories')
    );

    expect(onSearchPress).toHaveBeenCalledTimes(1);
  });

  it('forwards active search input changes and cancel actions', () => {
    const onSearchQueryChange = jest.fn();
    const onSearchCancel = jest.fn();
    const onSearchSubmit = jest.fn();

    render(
      <Header
        isSearchActive
        onSearchCancel={onSearchCancel}
        onSearchQueryChange={onSearchQueryChange}
        onSearchSubmit={onSearchSubmit}
        searchQuery="sam"
        showSearch
      />
    );

    const input = screen.getByPlaceholderText('Search products...');

    fireEvent.changeText(input, 'samsung');
    fireEvent(input, 'submitEditing');
    fireEvent.press(screen.getByRole('button', { name: 'Cancel search' }));

    expect(onSearchQueryChange).toHaveBeenCalledWith('samsung');
    expect(onSearchSubmit).toHaveBeenCalledTimes(1);
    expect(onSearchCancel).toHaveBeenCalledTimes(1);
  });
});
