import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, waitFor } from '@testing-library/react-native';
import { iphone11ProMax } from '@/lib/product-route/product-detail-screen.fixtures';
import {
  getLastMockProps,
  mockProductDetailsBody,
  mockProductImageGallery,
  mockStickyBottomActions,
  mockUseEffectivePrice,
  mockUseLocalSearchParams,
  mockUseProduct,
  ProductDetailScreen,
  resetProductDetailScreenMocks,
} from '../../../test-support/product/product-detail-screen.test-utils';

describe('iPhone 11 Pro Max — condition chip pricing', () => {
  beforeEach(() => resetProductDetailScreenMocks());

  it('computes min per-condition price from variants and forwards them to the condition chip selector', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'iphone-11-pro-max' });
    mockUseProduct.mockReturnValue({
      product: iphone11ProMax(),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockImplementation((_p: unknown, sel: unknown) => {
      const s = sel as { price?: number } | null;
      return { price: s?.price ?? 520000, comparePrice: undefined };
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      const latestProps = getLastMockProps<{
        conditionOffers: { condition: string; price: number }[];
      }>(mockProductDetailsBody);
      expect(latestProps?.conditionOffers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ condition: 'open_box', price: 520000 }),
          expect.objectContaining({ condition: 'used', price: 470000 }),
        ])
      );
    });
  });

  it('defaults the screen to the cheapest available condition and keeps the sticky cart CTA purchasable', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'iphone-11-pro-max' });
    mockUseProduct.mockReturnValue({
      product: iphone11ProMax(),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockImplementation((_p: unknown, sel: unknown) => {
      const s = sel as { price?: number } | null;
      return { price: s?.price ?? 520000, comparePrice: undefined };
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(
        getLastMockProps<{
          availableConditions: string[];
          selectedCondition: string | null;
        }>(mockProductDetailsBody)
      ).toEqual(
        expect.objectContaining({
          availableConditions: ['used', 'open_box'],
          selectedCondition: 'used',
        })
      );
    });

    await waitFor(() => {
      expect(
        getLastMockProps<{ canPurchase: boolean }>(mockStickyBottomActions)
      ).toEqual(
        expect.objectContaining({
          canPurchase: true,
        })
      );
    });
  });

  it('keeps the same used 64GB price when image-driven color selection changes between colors', async () => {
    mockUseLocalSearchParams.mockReturnValue({ slug: 'iphone-11-pro-max' });
    mockUseProduct.mockReturnValue({
      product: iphone11ProMax(),
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockUseEffectivePrice.mockImplementation((_p: unknown, sel: unknown) => {
      const s = sel as { price?: number } | null;
      return { price: s?.price ?? 520000, comparePrice: undefined };
    });

    render(<ProductDetailScreen />);

    await waitFor(() => {
      expect(
        getLastMockProps<{
          selectedAttributes: Record<string, string>;
          selectedCondition: string | null;
          selectedStorage: string | null;
          selectedColor: string | null;
          effectivePrice: number;
        }>(mockProductDetailsBody)
      ).toEqual(
        expect.objectContaining({
          selectedAttributes: {},
          selectedCondition: 'used',
          selectedStorage: '64GB',
          selectedColor: 'Midnight Green',
          effectivePrice: 470000,
        })
      );
    });

    let initialColor = '';
    await waitFor(() => {
      initialColor =
        getLastMockProps<{
          selectedColor: string | null;
        }>(mockProductDetailsBody)?.selectedColor ?? '';
      expect(initialColor).toBeTruthy();
    });

    const goldGalleryProps = getLastMockProps<{
      images: string[];
      setSelectedImageIndex: (index: number) => void;
    }>(mockProductImageGallery);
    expect(goldGalleryProps).toBeDefined();

    const goldIndex =
      goldGalleryProps?.images.findIndex((image) =>
        image.includes('i11pm-gold')
      ) ?? -1;
    expect(goldIndex).toBeGreaterThanOrEqual(0);
    const goldImageUrl = goldGalleryProps?.images[goldIndex];
    expect(goldImageUrl).toBeTruthy();

    act(() => {
      goldGalleryProps?.setSelectedImageIndex(goldIndex);
    });

    await waitFor(() => {
      expect(
        getLastMockProps<{
          selectedAttributes: Record<string, string>;
          selectedCondition: string | null;
          selectedStorage: string | null;
          selectedColor: string | null;
          effectivePrice: number;
        }>(mockProductDetailsBody)
      ).toEqual(
        expect.objectContaining({
          selectedAttributes: {},
          selectedCondition: 'used',
          selectedStorage: '64GB',
          selectedColor: 'Gold',
          effectivePrice: 470000,
        })
      );
    });

    const nextGalleryProps = getLastMockProps<{
      images: string[];
      setSelectedImageIndex: (index: number) => void;
    }>(mockProductImageGallery);
    expect(nextGalleryProps).toBeDefined();

    const nextColorIndex =
      nextGalleryProps?.images.findIndex(
        (image) =>
          image !== goldImageUrl &&
          (image.includes('i11pm-silver') || image.includes('i11pm-space-gray'))
      ) ?? -1;
    expect(nextColorIndex).toBeGreaterThanOrEqual(0);

    act(() => {
      nextGalleryProps?.setSelectedImageIndex(nextColorIndex);
    });

    await waitFor(() => {
      const latestProps = getLastMockProps<{
        selectedCondition: string | null;
        selectedStorage: string | null;
        selectedColor: string | null;
        effectivePrice: number;
      }>(mockProductDetailsBody);

      expect(latestProps).toEqual(
        expect.objectContaining({
          selectedCondition: 'used',
          selectedStorage: '64GB',
          effectivePrice: 470000,
        })
      );
      expect(latestProps?.selectedColor).toBeTruthy();
      expect(latestProps?.selectedColor).not.toBe(initialColor);
    });
  });
});
