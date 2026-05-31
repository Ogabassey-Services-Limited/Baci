import { afterEach, beforeEach, jest } from '@jest/globals';
import type { Href } from 'expo-router';
import type React from 'react';
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
export const mockRouterPush = jest.fn<(href: Href) => void>();
const MockText = Text;
const MockView = View;
type MockBlock = { props?: { id?: string }; type: string };

type MockBlockRendererProps = {
  blocks: MockBlock[];
  getProductGridLoadMoreSignal?: (block: MockBlock, index: number) => number;
  productGridLoadMoreSignal?: number;
  renderAfterBlock?: (block: MockBlock, index: number) => React.ReactNode;
};

type MockProductGridCall = [
  MockBlockRendererProps & {
    blocks: [MockBlock];
    productGridLoadMoreSignal: number;
  },
];

const mockHeader = jest.fn(({ isScrolled }: { isScrolled?: boolean }) => (
  <MockText testID="mock-header">Header {String(isScrolled)}</MockText>
));

function getBlockLoadMoreSignal(
  props: MockBlockRendererProps,
  block: MockBlock,
  index: number
) {
  if (block.type !== 'ProductGrid') return 0;
  return (
    props.getProductGridLoadMoreSignal?.(block, index) ??
    props.productGridLoadMoreSignal ??
    0
  );
}

export const mockBlockRenderer = jest.fn((props: MockBlockRendererProps) => (
  <>
    {props.blocks.map((block, index) => (
      <MockView
        key={block.props?.id ?? `${block.type}-${index}`}
        testID="block-renderer"
      >
        <MockText>{block.type}</MockText>
        <MockText>
          {String(getBlockLoadMoreSignal(props, block, index))}
        </MockText>
        {props.renderAfterBlock?.(block, index)}
      </MockView>
    ))}
  </>
));

jest.mock('expo-image', () => ({
  Image: MockView,
}));

jest.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
  useRouter: () => ({
    push: mockRouterPush,
  }),
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
  BlockRenderer: (props: MockBlockRendererProps) => mockBlockRenderer(props),
}));

jest.mock('@/components/storefront/Header', () => ({
  Header: (props: { isScrolled?: boolean }) => mockHeader(props),
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
  return mockBlockRenderer.mock.calls.flatMap(([props]) =>
    props.blocks.flatMap((block, index): MockProductGridCall[] => {
      if (block.type !== 'ProductGrid') return [];
      return [
        [
          {
            ...props,
            blocks: [block],
            productGridLoadMoreSignal: getBlockLoadMoreSignal(
              props,
              block,
              index
            ),
          },
        ],
      ];
    })
  );
}

export function setupHomeScreenTestState() {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockHeader.mockClear();
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
