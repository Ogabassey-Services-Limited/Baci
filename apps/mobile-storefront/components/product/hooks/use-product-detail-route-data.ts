import { resolveVariantSelectionParamResolution } from '@baci/shared/lib';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useProduct } from '@/hooks';
import { useNetworkState } from '@/hooks/use-network-state';
import { useReviews } from '@/hooks/use-reviews';
import { PLACEHOLDER_IMAGE_URL } from '@/constants/Images';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import { resolveProductVariantMetadata } from '@/lib/product-variant-metadata';
import { getFallbackVariantSelections } from './get-fallback-variant-selections';
import { getFirstImageIndexForColor } from './get-first-image-index-for-color';
import { getSelectionSyncSignature } from './get-selection-sync-signature';
import { useProductDetailSelection } from './use-product-detail-selection';
import { getFirstRouteParamValue } from '../product-detail-route-params';

export function useProductDetailRouteData() {
  const routeParams = useLocalSearchParams();
  const slug = getFirstRouteParamValue(routeParams.slug);
  const routeConditionParam = getFirstRouteParamValue(routeParams.condition);
  const isValidSlug = Boolean(
    slug && typeof slug === 'string' && slug.length > 0
  );
  const { isOnline } = useNetworkState();
  const { product, isLoading, error, refetch } = useProduct(
    isValidSlug ? (slug ?? '') : ''
  );
  const reviewsState = useReviews({ productId: product?.id || '' });
  const usesVariantRouteSelection = Boolean(
    product?.has_variants && product.variants && product.variants.length > 0
  );
  const routeSelectionResolution =
    usesVariantRouteSelection && product
      ? resolveVariantSelectionParamResolution(product, routeParams)
      : null;
  const routeSelectionInput = routeSelectionResolution?.selectionInput ?? {};
  const routeSelectionAttributes = (routeSelectionInput.attributes ??
    {}) as Record<string, string>;
  const routeCondition = normalizeRouteCondition(
    routeSelectionInput.condition ??
      (!usesVariantRouteSelection ? routeConditionParam : undefined)
  );
  const routeVariantId = routeSelectionInput.variantId ?? null;
  const routeSelectionSignature = JSON.stringify({
    attributes: Object.fromEntries(
      Object.entries(routeSelectionAttributes).sort(([a], [b]) =>
        a.localeCompare(b)
      )
    ),
    condition: routeCondition,
    slug,
    variantId: routeVariantId,
  });
  const productVariantMetadata = product
    ? resolveProductVariantMetadata({
        colorImages: product.color_images,
        productImages: product.images,
        productColors: product.colors,
        sourceVariantAttributes: product.variant_attributes,
        variants: product.variants,
      })
    : {};
  const productGalleryImages = productVariantMetadata.galleryImages?.length
    ? productVariantMetadata.galleryImages
    : product?.images?.length
      ? product.images
      : product?.image
        ? [product.image]
        : [PLACEHOLDER_IMAGE_URL];
  const productImageColorMap = productVariantMetadata.imageColorMap ?? {};
  const resolvedColorImages =
    productVariantMetadata.colorImages ?? product?.color_images;
  const selection = useProductDetailSelection({
    getFallbackVariantSelections,
    getFirstImageIndexForColor,
    getSelectionSyncSignature,
    product,
    productGalleryImages,
    productImageColorMap,
    resolvedColorImages,
    routeCondition,
    routeSelectionAttributes,
    routeSelectionSignature,
    routeVariantId,
  });
  const { selectedImageIndex, setSelectedImageIndex } = selection;
  const offerConditionKey =
    product?.has_variants === true
      ? null
      : selection.effectiveSelectedCondition ||
        (product?.offers?.length === 1
          ? (product.offers[0]?.condition ?? null)
          : null);
  const displayProduct = product
    ? {
        ...product,
        color_images: resolvedColorImages,
        colors: productVariantMetadata.colors ?? product.colors,
        variant_attributes:
          productVariantMetadata.variantAttributes ??
          product.variant_attributes,
      }
    : null;
  const hasInvalidSelectionRedirectedRef = useRef(false);

  useEffect(() => {
    if (
      isValidSlug &&
      typeof slug === 'string' &&
      product?.slug &&
      product.slug !== slug
    ) {
      router.replace(`/product/${product.slug}`);
    }
  }, [isValidSlug, product?.slug, slug]);

  useEffect(() => {
    if (!product?.slug || product.slug !== slug) return;
    if (!routeSelectionResolution?.extracted.hasRecognizedSelectionParams) {
      hasInvalidSelectionRedirectedRef.current = false;
      return;
    }
    if (
      !hasInvalidSelectionRedirectedRef.current &&
      (routeSelectionResolution.type === 'attribute_only' ||
        routeSelectionResolution.type === 'ambiguous' ||
        routeSelectionResolution.type === 'invalid_variant_id' ||
        routeSelectionResolution.type === 'zero_match')
    ) {
      hasInvalidSelectionRedirectedRef.current = true;
      router.replace(`/product/${product.slug}`);
    }
  }, [
    product?.slug,
    routeSelectionResolution?.extracted.hasRecognizedSelectionParams,
    routeSelectionResolution?.type,
    slug,
  ]);

  useEffect(() => {
    if (selectedImageIndex >= productGalleryImages.length) {
      setSelectedImageIndex(0);
    }
  }, [productGalleryImages.length, selectedImageIndex, setSelectedImageIndex]);

  return {
    displayProduct,
    error,
    isLoading,
    isOnline,
    isValidSlug,
    offerConditionKey,
    product,
    productGalleryImages,
    productImageColorMap,
    refetch,
    resolvedColorImages,
    reviewsState,
    routeParams,
    slug,
    ...selection,
  };
}
