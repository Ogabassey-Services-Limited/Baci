import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockUseProducts = jest.fn();
const mockUsePinned = jest.fn();

jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-router', () => ({
  router: { push: (path: string) => mockPush(path) },
}));
jest.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#ffffff',
      background: '#ffffff',
      text: '#000000',
      textSecondary: '#666666',
      primary: '#d62027',
      border: '#cccccc',
    },
  }),
}));
jest.mock('@/hooks/use-products', () => ({
  useProducts: () => mockUseProducts(),
}));
jest.mock('@/hooks/use-pinned-launch-products', () => ({
  usePinnedLaunchProducts: () => mockUsePinned(),
}));
jest.mock('@/components/ui/Skeleton', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return { Skeleton: () => <View accessibilityRole="progressbar" accessible /> };
});

import { JustLaunchedCarousel } from './JustLaunchedCarousel';

const a27 = {
  id: 'a27',
  name: 'Samsung Galaxy A27 5G Preorder',
  slug: 'samsung-galaxy-a27-5g',
  price: 50000,
  image: 'https://cdn.ogabassey.com/core-assets/products/a27.avif',
};
const xiaomi = {
  id: 'xiaomi',
  name: 'Xiaomi 17T',
  slug: 'xiaomi-17t',
  price: 800000,
  image: 'https://cdn.ogabassey.com/core-assets/products/xiaomi.avif',
};

describe('JustLaunchedCarousel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePinned.mockReturnValue({ data: [] });
    mockUseProducts.mockReturnValue({
      products: [],
      isLoading: false,
      isError: false,
    });
  });

  it('renders pinned-first slides and navigates to the product on press', () => {
    mockUsePinned.mockReturnValue({ data: [a27] });
    mockUseProducts.mockReturnValue({
      products: [xiaomi, a27],
      isLoading: false,
      isError: false,
    });

    render(<JustLaunchedCarousel />);

    expect(screen.getByText('Samsung Galaxy A27 5G Preorder')).toBeTruthy();
    expect(screen.getByText('Xiaomi 17T')).toBeTruthy();
    // Pre-order-aware CTA from the shared helper.
    expect(screen.getByText('Pre-order now')).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: /Samsung Galaxy A27 5G Preorder/ })
    );
    expect(mockPush).toHaveBeenCalledWith('/product/samsung-galaxy-a27-5g');
  });

  it('renders a loading skeleton (not a blank gap) while loading', () => {
    mockUseProducts.mockReturnValue({
      products: [],
      isLoading: true,
      isError: false,
    });

    render(<JustLaunchedCarousel />);

    expect(screen.getByText('Just Launched')).toBeTruthy();
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
  });

  it('renders nothing on error', () => {
    mockUseProducts.mockReturnValue({
      products: [],
      isLoading: false,
      isError: true,
    });

    const { toJSON } = render(<JustLaunchedCarousel />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when there are no launch products', () => {
    mockUseProducts.mockReturnValue({
      products: [],
      isLoading: false,
      isError: false,
    });
    mockUsePinned.mockReturnValue({ data: [] });

    const { toJSON } = render(<JustLaunchedCarousel />);
    expect(toJSON()).toBeNull();
  });
});
