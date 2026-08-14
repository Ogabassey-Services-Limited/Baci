import { render, screen } from '@testing-library/react-native';
import { DrawerMenu } from './DrawerMenu';

let mockIsOpen = true;

// Mock SafeAreaProvider / useSafeAreaInsets cleanly
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 20, left: 0, right: 0 }),
}));

// Mock optional gesture handler to avoid real native Gesture Handler requirements in test environment
jest.mock('@/lib/optional-gesture-handler', () => {
  const mockPanGesture = {
    activeOffsetX: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
  };
  return {
    getOptionalGestureHandlerRuntime: () => ({
      Gesture: {
        Pan: () => mockPanGesture,
      },
      GestureDetector: ({ children }: { children: unknown }) => children,
      GestureHandlerRootView: ({ children }: { children: unknown }) => children,
    }),
  };
});

// Mock Reanimated cleanly
jest.mock('react-native-reanimated', () => {
  const { View, Text } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const makeSharedValue = (init: number) => {
    let _value = init;
    return {
      get value() {
        return _value;
      },
      set value(v: number) {
        _value = v;
      },
      get: () => _value,
      set: (v: number) => {
        _value = v;
      },
    };
  };

  return {
    default: { View, Text },
    View,
    Text,
    cancelAnimation: jest.fn(),
    Easing: {
      in: jest.fn(),
      out: jest.fn(),
      cubic: jest.fn(),
    },
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
    useSharedValue: makeSharedValue,
    useAnimatedStyle: () => ({}),
    withTiming: (value: number, _config?: unknown, callback?: () => void) => {
      if (callback) callback();
      return value;
    },
  };
});

jest.mock('@/stores/drawer-store', () => ({
  useDrawerStore: () => ({
    isOpen: mockIsOpen,
    closeDrawer: jest.fn(),
  }),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: () => ({
    user: null,
    isInitialized: true,
    signOut: jest.fn(),
  }),
}));

jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#ffffff',
      border: '#eeeeee',
      text: '#000000',
      textSecondary: '#666666',
      muted: '#f5f5f5',
      foreground: '#000000',
      background: '#ffffff',
      icon: '#333333',
    },
    isDark: false,
  }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('DrawerMenu', () => {
  beforeEach(() => {
    mockIsOpen = true;
  });

  it('renders correctly with GadgetPattern background decoration', () => {
    render(<DrawerMenu />);

    expect(screen.getByTestId('tech-backdrop')).toBeTruthy();
  });

  it('does not mount the decorative backdrop while the drawer is closed', () => {
    mockIsOpen = false;

    render(<DrawerMenu />);

    expect(screen.queryByTestId('tech-backdrop')).toBeNull();
  });
});
