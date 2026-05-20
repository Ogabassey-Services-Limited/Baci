import {
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
} from '@baci/shared/lib';
import { useEffect, useRef, useState } from 'react';
import { stripInternalSelectionAxes } from '@/lib/product-internal-selection-axes';
import { computeProductSelectionState } from '@/lib/product-route/product-selection';
import type { Product, ProductCondition } from '@/types/product';
import { resolveAvailableProductCondition } from './product-condition-selection';

type FirstImageIndexForColorInput = {
  color: string | null | undefined;
  colorImages?: Record<string, string[]>;
  images: string[];
};

type UseProductDetailSelectionArgs = {
  getFallbackVariantSelections: (product: Product | null) => {
    attributes: Record<string, string>;
    color: string | null;
    storage: string | null;
  };
  getFirstImageIndexForColor: (args: FirstImageIndexForColorInput) => number;
  getSelectionSyncSignature: (product: Product | null) => string;
  product: Product | null;
  productGalleryImages: string[];
  productImageColorMap: Record<string, string>;
  resolvedColorImages?: Record<string, string[]>;
  routeCondition: ProductCondition | null;
  routeSelectionAttributes: Record<string, string>;
  routeSelectionSignature: string;
  routeVariantId: string | null;
};

export function useProductDetailSelection({
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
}: UseProductDetailSelectionArgs) {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] =
    useState<ProductCondition | null>(routeCondition);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [hasCustomizedSelection, setHasCustomizedSelection] = useState(false);
  const lastSelectionSyncSignatureRef = useRef<string>('');
  const lastRouteSelectionSignatureRef = useRef(routeSelectionSignature);
  const pendingRouteReseedRef = useRef(false);

  const usesImageDrivenColorSelection =
    Object.keys(productImageColorMap).length > 0;
  const defaultVariantSelection = product
    ? resolveDefaultVariantSelection(product)
    : null;
  const {
    availableConditions,
    currentVariantDisplaySelection,
    currentVariantSelection,
    effectiveSelectedAttributes,
    effectiveSelectedColor,
    effectiveSelectedCondition,
    effectiveSelectedStorage,
    effectiveSelectedVariantId,
    usesVariantConditions,
  } = computeProductSelectionState({
    defaultVariantSelection,
    product,
    routeCondition,
    routeSelectionAttributes,
    routeVariantId: hasCustomizedSelection ? null : routeVariantId,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedStorage,
    selectedVariant,
  });
  const selectionSyncSignature = getSelectionSyncSignature(product);

  useEffect(() => {
    if (lastRouteSelectionSignatureRef.current === routeSelectionSignature) {
      return;
    }

    lastRouteSelectionSignatureRef.current = routeSelectionSignature;
    pendingRouteReseedRef.current = true;
    setHasCustomizedSelection(false);
    setSelectedVariant(null);
    setSelectedColor(null);
    setSelectedStorage(null);
    setSelectedAttributes({});
    setSelectedCondition(routeCondition);
    setSelectedImageIndex(0);
  }, [routeCondition, routeSelectionSignature]);

  useEffect(() => {
    if (!product) {
      lastSelectionSyncSignatureRef.current = '';
      pendingRouteReseedRef.current = false;
      return;
    }

    const shouldForceRouteSeed = pendingRouteReseedRef.current;
    const shouldRepairInvalidSelection =
      product.has_variants === true &&
      (product.variants?.length ?? 0) > 0 &&
      currentVariantDisplaySelection === null;

    if (
      lastSelectionSyncSignatureRef.current === selectionSyncSignature &&
      !shouldForceRouteSeed &&
      !shouldRepairInvalidSelection
    ) {
      return;
    }

    const shouldSeedSelection =
      shouldForceRouteSeed ||
      (!selectedVariant &&
        !selectedStorage &&
        !selectedColor &&
        Object.keys(selectedAttributes).length === 0);
    const seededSelection =
      resolveVariantDisplaySelection(product, {
        condition: routeCondition,
        variantId: typeof routeVariantId === 'string' ? routeVariantId : null,
        attributes: routeSelectionAttributes,
      }) ??
      resolveDefaultVariantSelection(product, {
        condition: routeCondition,
      }) ??
      resolveDefaultVariantSelection(product);
    const activeColor = selectedColor ?? routeSelectionAttributes.color;
    const activeStorage = selectedStorage ?? routeSelectionAttributes.storage;
    const activeSelectionAttributes = {
      ...routeSelectionAttributes,
      ...selectedAttributes,
      ...(activeColor ? { color: activeColor } : {}),
      ...(activeStorage ? { storage: activeStorage } : {}),
    };
    const repairCondition = selectedCondition ?? routeCondition;
    const repairedSelection =
      resolveVariantDisplaySelection(product, {
        condition: repairCondition,
        variantId:
          selectedVariant ??
          (typeof routeVariantId === 'string' ? routeVariantId : null),
        attributes: activeSelectionAttributes,
      }) ??
      resolveDefaultVariantSelection(product, {
        condition: repairCondition,
      }) ??
      resolveDefaultVariantSelection(product);
    const nextSelection = shouldRepairInvalidSelection
      ? repairedSelection
      : seededSelection;
    const fallbackSelection = getFallbackVariantSelections(product);
    const syncedAttributes = {
      ...fallbackSelection.attributes,
      ...stripInternalSelectionAxes(nextSelection?.attributes ?? {}),
    };
    const resolvedLegacyColor =
      nextSelection?.attributes?.colour?.trim() || undefined;
    const syncedColor =
      nextSelection?.color ?? resolvedLegacyColor ?? fallbackSelection.color;

    if (shouldSeedSelection || shouldRepairInvalidSelection) {
      setSelectedVariant(nextSelection?.variant.id ?? null);
      setSelectedStorage(nextSelection?.storage ?? fallbackSelection.storage);
      setSelectedColor(syncedColor);
      setSelectedAttributes(syncedAttributes);
      setSelectedImageIndex(
        getFirstImageIndexForColor({
          color: syncedColor,
          colorImages: resolvedColorImages,
          images: productGalleryImages,
        })
      );
      if (nextSelection?.condition) {
        setSelectedCondition(nextSelection.condition as ProductCondition);
      }
    }

    pendingRouteReseedRef.current = false;
    lastSelectionSyncSignatureRef.current = selectionSyncSignature;
  }, [
    currentVariantDisplaySelection,
    getFallbackVariantSelections,
    getFirstImageIndexForColor,
    product,
    productGalleryImages,
    resolvedColorImages,
    routeCondition,
    routeSelectionAttributes,
    routeVariantId,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedStorage,
    selectedVariant,
    selectionSyncSignature,
  ]);

  useEffect(() => {
    if (!usesImageDrivenColorSelection || !effectiveSelectedColor) {
      return;
    }

    const currentImage = productGalleryImages[selectedImageIndex];
    const currentImageColor = currentImage
      ? productImageColorMap[currentImage]
      : undefined;

    if (!currentImageColor || currentImageColor === effectiveSelectedColor) {
      return;
    }

    setSelectedImageIndex(
      getFirstImageIndexForColor({
        color: effectiveSelectedColor,
        colorImages: resolvedColorImages,
        images: productGalleryImages,
      })
    );
  }, [
    effectiveSelectedColor,
    getFirstImageIndexForColor,
    productGalleryImages,
    productImageColorMap,
    resolvedColorImages,
    selectedImageIndex,
    usesImageDrivenColorSelection,
  ]);

  useEffect(() => {
    const nextCondition = resolveAvailableProductCondition({
      availableConditions,
      preferredConditions: [
        selectedCondition,
        currentVariantDisplaySelection?.condition,
      ],
    });

    if (!nextCondition || nextCondition === selectedCondition) {
      return;
    }

    setSelectedCondition(nextCondition);
  }, [
    availableConditions,
    currentVariantDisplaySelection?.condition,
    selectedCondition,
  ]);

  return {
    availableConditions,
    currentVariantDisplaySelection,
    currentVariantSelection,
    effectiveSelectedAttributes,
    effectiveSelectedColor,
    effectiveSelectedCondition,
    effectiveSelectedStorage,
    effectiveSelectedVariantId,
    hasCustomizedSelection,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedImageIndex,
    selectedStorage,
    selectedVariant,
    setHasCustomizedSelection,
    setSelectedAttributes,
    setSelectedColor,
    setSelectedCondition,
    setSelectedImageIndex,
    setSelectedStorage,
    setSelectedVariant,
    usesImageDrivenColorSelection,
    usesVariantConditions,
  };
}
