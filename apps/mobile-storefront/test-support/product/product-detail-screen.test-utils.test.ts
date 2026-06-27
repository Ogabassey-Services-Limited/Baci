import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { baseProduct } from '../../lib/product-route/product-detail-screen.fixtures';
import {
  findNodeWithContentPadding,
  getLastMockProps,
  mockUseLocalSearchParams,
  mockUseProduct,
  PRODUCT_SCROLL_BOTTOM_PADDING,
  type RenderedNode,
  resetProductDetailScreenMocks,
} from './product-detail-screen.test-utils';

describe('product detail screen test utilities', () => {
  beforeEach(() => {
    resetProductDetailScreenMocks();
  });

  it('finds nested nodes by flattened content padding', () => {
    const matchingNode: RenderedNode = {
      props: {
        contentContainerStyle: [
          { paddingBottom: PRODUCT_SCROLL_BOTTOM_PADDING },
        ],
      },
    };
    const tree: RenderedNode = {
      children: [
        'text child',
        {
          children: [matchingNode],
        },
      ],
    };

    expect(
      findNodeWithContentPadding(tree, PRODUCT_SCROLL_BOTTOM_PADDING)
    ).toBe(matchingNode);
  });

  it('returns null when no node matches the requested content padding', () => {
    expect(
      findNodeWithContentPadding(
        { props: { contentContainerStyle: { paddingBottom: 12 } } },
        PRODUCT_SCROLL_BOTTOM_PADDING
      )
    ).toBeNull();
  });

  it('returns the first argument from the last mock call', () => {
    const mockFn = jest.fn();
    mockFn({ value: 1 }, 'ignored');
    mockFn({ value: 2 });

    expect(getLastMockProps<{ value: number }>(mockFn)).toEqual({ value: 2 });
  });

  it('resets product route mocks to the default loaded product route', () => {
    expect(mockUseLocalSearchParams()).toEqual({
      slug: 'legacy-iphone-13-pro',
    });
    expect(mockUseProduct()).toEqual(
      expect.objectContaining({
        error: null,
        isLoading: false,
        product: baseProduct,
      })
    );
  });
});
