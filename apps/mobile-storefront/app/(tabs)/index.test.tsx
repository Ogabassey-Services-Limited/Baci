import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { getHomeContentBottomPadding } from '@/constants/layout';
import type { MobileTemplateConfig } from '@/lib/templates';
import HomeScreen from './index';

function createTemplateConfig(
  overrides: Partial<MobileTemplateConfig> = {}
): MobileTemplateConfig {
  return {
    headerStyle: 'standard',
    heroVariant: 'standard',
    categoryStyle: 'pill',
    cardVariant: 'grid',
    spacing: 'compact',
    borderRadius: 'md',
    ...overrides,
  };
}

const mockUsePageConfig = jest.fn();
const mockUseColorScheme = jest.fn(() => 'dark');
const mockRequestPermission = jest.fn(async () => 'granted');
const mockGetTemplateConfig = jest.fn(
  (_businessType?: string, _manualTemplateId?: string) => createTemplateConfig()
);
const mockBlockRenderer = jest.fn(
  ({
    blocks,
    productGridLoadMoreSignal,
  }: {
    blocks: Array<{ type: string }>;
    productGridLoadMoreSignal?: number;
  }) => (
    <MockView testID="block-renderer">
      <MockText>{blocks[0]?.type}</MockText>
      <MockText>{String(productGridLoadMoreSignal ?? 0)}</MockText>
    </MockView>
  )
);
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
  BlockRenderer: (props: {
    blocks: Array<{ type: string }>;
    productGridLoadMoreSignal?: number;
  }) => mockBlockRenderer(props),
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
  __esModule: true,
  getTemplateConfig: (businessType?: string, manualTemplateId?: string) =>
    mockGetTemplateConfig(businessType, manualTemplateId),
}));

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockUseColorScheme.mockReturnValue('dark');
    mockRequestPermission.mockResolvedValue('granted');
    mockGetTemplateConfig.mockReturnValue(createTemplateConfig());
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
      paddingBottom: getHomeContentBottomPadding(34, true),
    });
  });

  it('uses tab-bar clearance only when the chat widget is disabled', () => {
    mockGetTemplateConfig.mockReturnValue({
      ...createTemplateConfig(),
      features: { chatWidget: false },
    });

    render(<HomeScreen />);

    expect(
      StyleSheet.flatten(
        screen.getByTestId('home-scroll-view').props.contentContainerStyle
      )
    ).toMatchObject({
      paddingBottom: getHomeContentBottomPadding(34, false),
    });
  });

  it('signals the product grid to load more when the home scroll reaches the bottom', () => {
    render(<HomeScreen />);

    const initialProductGridCalls = mockBlockRenderer.mock.calls.filter(
      ([props]) => props.blocks[0]?.type === 'ProductGrid'
    );
    expect(initialProductGridCalls.length).toBeGreaterThan(0);
    expect(
      initialProductGridCalls[initialProductGridCalls.length - 1]?.[0]
    ).toMatchObject({
      productGridLoadMoreSignal: 0,
    });

    fireEvent.scroll(screen.getByTestId('home-scroll-view'), {
      nativeEvent: {
        contentOffset: { x: 0, y: 1100 },
        contentSize: { width: 375, height: 1600 },
        layoutMeasurement: { width: 375, height: 300 },
      },
    });

    const productGridCalls = mockBlockRenderer.mock.calls.filter(
      ([props]) => props.blocks[0]?.type === 'ProductGrid'
    );
    expect(productGridCalls.length).toBeGreaterThan(0);

    const latestProductGridProps =
      productGridCalls[productGridCalls.length - 1]?.[0];

    expect(latestProductGridProps).toMatchObject({
      productGridLoadMoreSignal: 1,
    });
  });
});
