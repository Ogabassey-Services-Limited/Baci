import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import { baseProduct } from '@/lib/product-route/product-detail-screen.fixtures';
import type { ProductDetailsBodyProps } from './ProductDetailsBody';
import { ProductDetailsBody } from './ProductDetailsBody';

jest.mock('@/components/product/ConditionSelector', () => ({
  ConditionSelector: () => null,
}));

jest.mock('@/components/product/ReviewsList', () => ({
  ReviewsList: () => null,
}));

jest.mock('@/components/product/VariantSelector', () => ({
  VariantSelector: () => null,
}));

jest.mock('@/components/ui/HTMLRenderer', () => ({
  HTMLRenderer: () => null,
}));

jest.mock('react-native-reanimated', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: { View },
    View,
    FadeInDown: {
      delay: () => ({
        duration: () => ({}),
      }),
    },
  };
});

function createProps(
  overrides: Partial<ProductDetailsBodyProps> = {}
): ProductDetailsBodyProps {
  return {
    availableConditions: [],
    conditionOffers: [],
    product: {
      ...baseProduct,
      description: 'Premium smartphone',
    },
    effectivePrice: 552000,
    effectiveComparePrice: undefined,
    negotiatedPrice: null,
    canPurchase: true,
    selectedVariant: null,
    setSelectedVariant: jest.fn(),
    selectedCondition: null,
    setSelectedCondition: jest.fn(),
    selectedAttributes: {},
    selectedColor: null,
    selectedStorage: null,
    onSelectAttribute: jest.fn(),
    onSelectColor: jest.fn(),
    onSelectStorage: jest.fn(),
    onOpenNegotiation: jest.fn(),
    reviews: [],
    reviewStats: null,
    reviewsLoading: false,
    hasMoreReviews: false,
    loadMoreReviews: jest.fn(async () => undefined),
    onMarkHelpful: jest.fn(),
    colors: Colors.light,
    ...overrides,
  };
}

describe('ProductDetailsBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the offer CTA and delegates purchase actions to the screen footer', () => {
    const props = createProps();
    render(<ProductDetailsBody {...props} />);

    fireEvent.press(screen.getByText('Make an Offer'));

    expect(props.onOpenNegotiation).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Add to Cart' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'View Cart' })).toBeNull();
  });

  it('hides the offer CTA once a negotiated price exists', () => {
    render(
      <ProductDetailsBody
        {...createProps({
          negotiatedPrice: 470000,
        })}
      />
    );

    expect(screen.queryByRole('button', { name: 'Make an Offer' })).toBeNull();
    expect(screen.getByText('Your negotiated price!')).toBeTruthy();
  });
});
