import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import {
  HeroSkeleton,
  HomeScreenSkeleton,
  ProductCardSkeleton,
  ProductDetailSkeleton,
  ProductGridSkeleton,
  Skeleton,
} from './Skeleton';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('Skeleton', () => {
  it('marks the base skeleton as loading content', () => {
    render(<Skeleton width={120} height={24} borderRadius={8} />);

    expect(
      screen.getByRole('progressbar', { name: 'Loading content' })
    ).toBeOnTheScreen();
  });

  it('renders product card placeholders', () => {
    render(<ProductCardSkeleton />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  });

  it('renders a configurable product grid', () => {
    render(<ProductGridSkeleton count={2} />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(8);
  });

  it('renders hero loading dots', () => {
    render(<HeroSkeleton />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  });

  it('renders home and product detail skeletons without dropping loading affordances', () => {
    const homeRender = render(<HomeScreenSkeleton />);

    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(10);

    homeRender.unmount();
    render(<ProductDetailSkeleton />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(8);
  });
});
