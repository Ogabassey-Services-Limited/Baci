import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationContext } from 'expo-router/react-navigation';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import type { Block } from '@/types/blocks';
import { HomeScreenView } from './HomeScreenView';

const mockSetNavigationBarStyle = jest.fn();
let mockColorScheme: 'dark' | 'light' = 'light';
const originalPlatformOS = Platform.OS;
type NavigationContextValue = NonNullable<
  ComponentProps<typeof NavigationContext.Provider>['value']
>;
type FocusEventName = 'blur' | 'focus';

function setPlatformOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', {
    configurable: true,
    value: os,
  });
}

jest.mock('expo-navigation-bar', () => ({
  setStyle: (...args: unknown[]) => mockSetNavigationBarStyle(...args),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockColorScheme,
}));

jest.mock('expo-image', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    Image: () => <Text>Elite texture</Text>,
  };
});

jest.mock('@/components/storefront/GadgetPattern', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    GadgetPattern: ({ color }: { color?: string }) => (
      <Text>{color ? `Gadget pattern ${color}` : 'Elite texture'}</Text>
    ),
  };
});

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('@/components/OfflineNotice', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    OfflineNotice: ({ message }: { message?: string }) => (
      <Text>{message ?? 'Offline cached content'}</Text>
    ),
  };
});

jest.mock('@/components/storefront/BlockRenderer', () => {
  const { Text, View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    BlockRenderer: ({
      blocks,
      renderAfterBlock,
    }: {
      blocks: Block[];
      renderAfterBlock?: (block: Block, index: number) => React.ReactNode;
    }) => (
      <>
        {blocks.map((block, index) => (
          <View key={block.props.id}>
            <Text>{`Block ${block.type}`}</Text>
            {renderAfterBlock?.(block, index)}
          </View>
        ))}
      </>
    ),
  };
});

jest.mock('@/components/storefront/Header', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    Header: ({ onSearchPress }: { onSearchPress?: () => void }) => (
      <Text onPress={onSearchPress}>Header</Text>
    ),
  };
});

jest.mock('@/components/storefront/HomeServiceCards', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    HomeServiceCards: () => <Text>Services</Text>,
  };
});

jest.mock('@/components/storefront/SearchDropdown', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    SearchDropdown: ({
      isVisible,
      onClose,
    }: {
      isVisible: boolean;
      onClose: () => void;
    }) => (isVisible ? <Text onPress={onClose}>Search results</Text> : null),
  };
});

jest.mock('@/components/ui/PermissionModal', () => {
  const { Text, View } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    PermissionModal: ({
      onDeny,
      onGrant,
      visible,
    }: {
      onDeny: () => void;
      onGrant: () => void;
      visible: boolean;
    }) =>
      visible ? (
        <View>
          <Text>Permission request</Text>
          <Text onPress={onGrant}>Allow</Text>
          <Text onPress={onDeny}>Deny</Text>
        </View>
      ) : null,
  };
});

jest.mock('@/components/ui/Skeleton', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    HeroSkeleton: () => <Text>Hero skeleton</Text>,
    ProductGridSkeleton: () => <Text>Grid skeleton</Text>,
  };
});

jest.mock('@/components/ui/SnowEffect', () => {
  const { Text } = jest.requireActual(
    'react-native'
  ) as typeof import('react-native');

  return {
    SnowEffect: () => <Text>Snow effect</Text>,
  };
});

const blocks: Block[] = [
  { type: 'CategoryRail', props: { id: 'categories' } },
  {
    type: 'ProductGrid',
    props: { id: 'products', title: 'Featured Products' },
  },
];

function createProps() {
  return {
    backgroundColor: '#ffffff',
    blackColor: '#000000',
    blocks,
    contentBottomPadding: 84,
    hasPageConfig: true,
    headerVisibility: { value: 1 } as unknown as SharedValue<number>,
    isConfigLoading: false,
    isElite: false,
    isError: false,
    isOnline: true,
    isScrolled: false,
    onCategorySelect: jest.fn(),
    onHeaderLayout: jest.fn(),
    onListScroll: jest.fn(),
    onPermissionDeny: jest.fn(),
    onPermissionGrant: jest.fn(),
    onRefresh: jest.fn(async () => undefined),
    onSearch: jest.fn(),
    onSearchCancel: jest.fn(),
    onSearchQueryChange: jest.fn(),
    onSearchSubmit: jest.fn(),
    primaryColor: '#0ea5e9',
    primaryProductGridIndex: 1,
    productGridLoadMoreSignal: 2,
    refreshing: false,
    resolvedHeaderHeight: 150,
    searchQuery: '',
    searchVisible: false,
    selectedCategoryId: null,
    shouldRenderDecorations: true,
    showPermissionModal: false,
  };
}

function createNavigationMock(initialFocused = true) {
  let focused = initialFocused;
  const listeners: Record<FocusEventName, Array<() => void>> = {
    blur: [],
    focus: [],
  };
  const navigation = {
    addListener: jest.fn((eventName: FocusEventName, listener: () => void) => {
      listeners[eventName].push(listener);
      return () => {
        listeners[eventName] = listeners[eventName].filter(
          (currentListener) => currentListener !== listener
        );
      };
    }),
    isFocused: jest.fn(() => focused),
  } as unknown as NavigationContextValue;

  return {
    emit: (eventName: FocusEventName) => {
      focused = eventName === 'focus';
      act(() => {
        for (const listener of listeners[eventName]) {
          listener();
        }
      });
    },
    navigation,
  };
}

describe('HomeScreenView', () => {
  beforeEach(() => {
    mockSetNavigationBarStyle.mockClear();
    mockColorScheme = 'light';
    setPlatformOS(originalPlatformOS);
  });

  afterEach(() => {
    setPlatformOS(originalPlatformOS);
  });

  it('renders the loading shell while initial content loads', () => {
    render(<HomeScreenView {...createProps()} isConfigLoading={true} />);

    expect(screen.getByText('Header')).toBeTruthy();
    expect(screen.getByText('Hero skeleton')).toBeTruthy();
    expect(screen.getByText('Grid skeleton')).toBeTruthy();
    expect(screen.queryByTestId('home-scroll-view')).toBeNull();
  });

  it('keeps the root navigation bar style while the light loading shell is visible', () => {
    setPlatformOS('android');

    render(<HomeScreenView {...createProps()} isConfigLoading={true} />);

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('dark');
  });

  it('renders home blocks and delegates header and refresh interactions', () => {
    const onSearch = jest.fn();
    const onRefresh = jest.fn(async () => undefined);

    render(
      <HomeScreenView
        {...createProps()}
        onRefresh={onRefresh}
        onSearch={onSearch}
      />
    );

    expect(screen.getByText('Block CategoryRail')).toBeTruthy();
    expect(screen.getByText('Services')).toBeTruthy();
    expect(screen.getByText('Block ProductGrid')).toBeTruthy();

    fireEvent.press(screen.getByText('Header'));
    expect(onSearch).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('home-scroll-view'), 'refresh');
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('uses the active merchant theme color for decorative and refresh affordances', () => {
    render(<HomeScreenView {...createProps()} primaryColor="#22c55e" />);

    expect(screen.getByText('Gadget pattern #22c55e')).toBeTruthy();
  });

  it('renders the online error notice for an unsuccessful page request', () => {
    render(<HomeScreenView {...createProps()} isError={true} />);

    expect(screen.getByText('Failed to load content')).toBeTruthy();
  });

  it('shows cached-content feedback and the elite backdrop while offline', () => {
    render(
      <HomeScreenView {...createProps()} isElite={true} isOnline={false} />
    );

    expect(screen.getByText('Offline cached content')).toBeTruthy();
    expect(screen.getAllByText('Elite texture').length).toBeGreaterThan(0);
  });

  it('keeps heavy decorative layers deferred while rendering the elite backdrop immediately', () => {
    render(
      <HomeScreenView
        {...createProps()}
        isElite={true}
        shouldRenderDecorations={false}
      />
    );

    expect(screen.getByText('Block CategoryRail')).toBeTruthy();
    expect(screen.getByText('Elite texture')).toBeTruthy();
    expect(screen.queryByText('Snow effect')).toBeNull();
  });

  it('delegates permission choices and closing the visible search overlay', () => {
    const onPermissionDeny = jest.fn();
    const onPermissionGrant = jest.fn();
    const onSearchCancel = jest.fn();

    render(
      <HomeScreenView
        {...createProps()}
        onPermissionDeny={onPermissionDeny}
        onPermissionGrant={onPermissionGrant}
        onSearchCancel={onSearchCancel}
        searchVisible={true}
        showPermissionModal={true}
      />
    );

    fireEvent.press(screen.getByText('Allow'));
    fireEvent.press(screen.getByText('Deny'));
    fireEvent.press(screen.getByText('Search results'));

    expect(onPermissionGrant).toHaveBeenCalledTimes(1);
    expect(onPermissionDeny).toHaveBeenCalledTimes(1);
    expect(onSearchCancel).toHaveBeenCalledTimes(1);
  });

  it('restores the root navigation bar style when the Home tab loses focus', () => {
    setPlatformOS('android');
    const { emit, navigation } = createNavigationMock(true);

    const props = createProps();
    render(
      <NavigationContext.Provider value={navigation}>
        <HomeScreenView {...props} />
      </NavigationContext.Provider>
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');

    emit('blur');

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('dark');

    emit('focus');

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
  });

  it('reapplies light Home navigation bar buttons when the color scheme changes', () => {
    setPlatformOS('android');
    const { navigation } = createNavigationMock(true);

    const { rerender } = render(
      <NavigationContext.Provider value={navigation}>
        <HomeScreenView {...createProps()} />
      </NavigationContext.Provider>
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');

    mockColorScheme = 'dark';
    rerender(
      <NavigationContext.Provider value={navigation}>
        <HomeScreenView {...createProps()} />
      </NavigationContext.Provider>
    );

    expect(mockSetNavigationBarStyle).toHaveBeenLastCalledWith('light');
  });
});
