import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { getHomeContentBottomPadding } from '@/constants/layout';
import HomeScreen from './index';

const mockUsePageConfig = jest.fn();
const mockUseColorScheme = jest.fn(() => 'dark');
const mockRequestPermission = jest.fn(async () => 'granted');
const MockText = Text;
const MockView = View;

jest.mock('expo-image', () => ({
  Image: MockView,
}));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 59,
    right: 0,
    bottom: 34,
    left: 0,
  }),
}));

jest.mock('@/components/OfflineNotice', () => ({
  OfflineNotice: () => <MockText>Offline notice</MockText>,
}));

jest.mock('@/components/storefront/BlockRenderer', () => ({
  BlockRenderer: ({ blocks }: { blocks: Array<{ type: string }> }) => (
    <MockView testID="block-renderer">
      <MockText>{blocks[0]?.type}</MockText>
    </MockView>
  ),
}));

jest.mock('@/components/storefront/Header', () => ({
  Header: () => <MockText>Header</MockText>,
}));

jest.mock('@/components/storefront/SearchDropdown', () => ({
  SearchDropdown: () => null,
}));

jest.mock('@/components/ui/PermissionModal', () => ({
  PermissionModal: () => null,
}));

jest.mock('@/components/ui/Skeleton', () => ({
  HeroSkeleton: () => <MockText>Hero skeleton</MockText>,
  ProductGridSkeleton: () => <MockText>Grid skeleton</MockText>,
}));

jest.mock('@/components/ui/SnowEffect', () => ({
  SnowEffect: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => mockUseColorScheme(),
}));

jest.mock('@/hooks', () => ({
  __esModule: true,
  usePageConfig: (...args: [string?]) => mockUsePageConfig(...args),
}));

jest.mock('@/hooks/use-network-state', () => ({
  useNetworkState: () => ({ isOnline: true }),
}));

jest.mock('@/hooks/use-permission-booster', () => ({
  usePermissionBooster: () => ({
    requestPermission: mockRequestPermission,
    triggerSystemPrompt: jest.fn(),
    markDenied: jest.fn(),
  }),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: {
    BUSINESS_TYPE: 'gadgets',
    TEMPLATE_ID: 'default',
  },
}));

jest.mock('@/lib/scroll-header-visibility', () => ({
  resolveScrollHeaderVisibility: ({
    currentOffsetY,
    isVisible,
  }: {
    currentOffsetY: number;
    isVisible: boolean;
  }) => ({
    isVisible,
    previousOffsetY: currentOffsetY,
  }),
}));

jest.mock('@/lib/templates', () => ({
  getTemplateConfig: () => ({
    headerStyle: 'standard',
    cardVariant: 'grid',
  }),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockRequestPermission.mockResolvedValue('granted');
    mockUsePageConfig.mockReturnValue({
      data: {
        content: [
          { type: 'HeroCarousel', props: { id: 'hero-1', slides: [] } },
          { type: 'CategoryRail', props: { id: 'categories-1' } },
          { type: 'ProductGrid', props: { id: 'products-1', limit: 12 } },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders home content inside a scroll view with bottom clearance for overlays', () => {
    render(<HomeScreen />);

    expect(screen.getByTestId('home-scroll-view')).toBeTruthy();
    expect(screen.getAllByTestId('block-renderer')).toHaveLength(3);
    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-scroll-view').props.contentContainerStyle
      )
    ).toMatchObject({
      paddingBottom: getHomeContentBottomPadding(34),
    });
  });
});
