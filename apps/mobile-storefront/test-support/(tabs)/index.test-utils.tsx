import { afterEach, beforeEach, jest } from '@jest/globals';
import { Text, View } from 'react-native';
import type { MobileTemplateConfig } from '@/lib/templates';

export function createTemplateConfig(
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

export const mockUsePageConfig = jest.fn();
export const mockUseColorScheme = jest.fn(() => 'dark');
export const mockRequestPermission = jest.fn(async () => 'granted');
export const mockGetTemplateConfig = jest.fn(
  (_businessType?: string, _manualTemplateId?: string) => createTemplateConfig()
);
const MockText = Text;
const MockView = View;

export const mockBlockRenderer = jest.fn(
  ({
    blocks,
    productGridLoadMoreSignal,
  }: {
    blocks: Array<{ props?: { id?: string }; type: string }>;
    productGridLoadMoreSignal?: number;
  }) => (
    <MockView testID="block-renderer">
      <MockText>{blocks[0]?.type}</MockText>
      <MockText>{String(productGridLoadMoreSignal ?? 0)}</MockText>
    </MockView>
  )
);

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
    blocks: Array<{ props?: { id?: string }; type: string }>;
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

export function getProductGridCalls() {
  return mockBlockRenderer.mock.calls.filter(
    ([props]) => props.blocks[0]?.type === 'ProductGrid'
  );
}

export function setupHomeScreenTestState() {
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
}

export { default as HomeScreen } from '../../app/(tabs)/index';
