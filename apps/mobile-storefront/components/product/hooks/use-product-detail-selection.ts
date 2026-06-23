import {
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
} from '@baci/shared/lib';
import { useState } from 'react';
import { stripInternalSelectionAxes } from '@/lib/product-internal-selection-axes';
import { computeProductSelectionState } from '@/lib/product-route/product-selection';
import type { Product, ProductCondition } from '@/types/product';
import { resolveAvailableProductCondition } from './product-condition-selection';
import { shallowEqualRecord } from './shallow-equal-record';
import { resolveProductDetailDefaultVariantSelection } from './use-product-detail-default-variant-selection';

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
  const [lastSelectionSyncSignature, setLastSelectionSyncSignature] =
    useState('');
  const [prevRouteSelectionSignature, setPrevRouteSelectionSignature] =
    useState(routeSelectionSignature);
  const [pendingRouteReseed, setPendingRouteReseed] = useState(false);

  if (prevRouteSelectionSignature !== routeSelectionSignature) {
    setPrevRouteSelectionSignature(routeSelectionSignature);
    setPendingRouteReseed(true);
    setHasCustomizedSelection(false);
    setSelectedVariant(null);
    setSelectedColor(null);
    setSelectedStorage(null);
    setSelectedAttributes({});
    setSelectedCondition(routeCondition);
    setSelectedImageIndex(0);
  }

  const usesImageDrivenColorSelection =
    Object.keys(productImageColorMap).length > 0;
  const defaultVariantSelection =
    resolveProductDetailDefaultVariantSelection(product);
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

  if (product) {
    const shouldForceRouteSeed = pendingRouteReseed;
    const shouldRepairInvalidSelection =
      product.has_variants === true &&
      (product.variants?.length ?? 0) > 0 &&
      currentVariantDisplaySelection === null;
    const needsSelectionSync =
      lastSelectionSyncSignature !== selectionSyncSignature ||
      shouldForceRouteSeed ||
      shouldRepairInvalidSelection;

    if (needsSelectionSync) {
      const shouldSeedSelection =
        shouldForceRouteSeed ||
        (!selectedVariant &&
          !selectedStorage &&
          !selectedColor &&
          Object.keys(selectedAttributes).length === 0);
      // Seed the on-open selection: honor an explicit route condition when one
      // is present, otherwise open on the cheapest buyable variant (price-first,
      // PDP-only). Falls back to the shared condition-first default.
      const seededSelection =
        resolveVariantDisplaySelection(product, {
          condition: routeCondition,
          variantId: typeof routeVariantId === 'string' ? routeVariantId : null,
          attributes: routeSelectionAttributes,
        }) ??
        (routeCondition
          ? resolveDefaultVariantSelection(product, {
              condition: routeCondition,
            })
          : resolveProductDetailDefaultVariantSelection(product)) ??
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
        ...stripInternalSelectionAxes(nextSelection?.attributes ?? {}, {
          preserveCondition: !usesVariantConditions,
        }),
      };
      const resolvedLegacyColor =
        nextSelection?.attributes?.colour?.trim() || undefined;
      // Preserve a user-selected image-driven color: one that exists in
      // color_images but is NOT a variant axis (e.g. a phone whose variants
      // differ by storage only). Without this, the repair below would revert
      // the color to the product default and snap the gallery image back,
      // making such colors unselectable.
      const imageDrivenSelectedColor =
        selectedColor &&
        Object.keys(resolvedColorImages ?? {}).includes(selectedColor)
          ? selectedColor
          : undefined;
      const syncedColor =
        nextSelection?.color ??
        resolvedLegacyColor ??
        imageDrivenSelectedColor ??
        fallbackSelection.color;

      if (shouldSeedSelection || shouldRepairInvalidSelection) {
        // Guard every setter behind value equality: a repair that cannot
        // resolve a variant must settle on the second render pass instead of
        // re-queueing fresh state (fresh object identities here would
        // otherwise loop "Too many re-renders").
        const nextVariant = nextSelection?.variant.id ?? null;
        const nextStorage = nextSelection?.storage ?? fallbackSelection.storage;
        const nextColor = syncedColor ?? null;
        const nextImageIndex = getFirstImageIndexForColor({
          color: syncedColor,
          colorImages: resolvedColorImages,
          images: productGalleryImages,
        });
        if (selectedVariant !== nextVariant) {
          setSelectedVariant(nextVariant);
        }
        if (selectedStorage !== (nextStorage ?? null)) {
          setSelectedStorage(nextStorage ?? null);
        }
        if (selectedColor !== nextColor) {
          setSelectedColor(nextColor);
        }
        if (!shallowEqualRecord(selectedAttributes, syncedAttributes)) {
          setSelectedAttributes(syncedAttributes);
        }
        if (selectedImageIndex !== nextImageIndex) {
          setSelectedImageIndex(nextImageIndex);
        }
        if (
          nextSelection?.condition &&
          selectedCondition !== nextSelection.condition
        ) {
          setSelectedCondition(nextSelection.condition as ProductCondition);
        }
      }

      if (pendingRouteReseed) {
        setPendingRouteReseed(false);
      }
      if (lastSelectionSyncSignature !== selectionSyncSignature) {
        setLastSelectionSyncSignature(selectionSyncSignature);
      }
    }
  } else {
    if (lastSelectionSyncSignature !== '') {
      setLastSelectionSyncSignature('');
    }
    if (pendingRouteReseed) {
      setPendingRouteReseed(false);
    }
  }

  if (usesImageDrivenColorSelection && effectiveSelectedColor) {
    const currentImage = productGalleryImages[selectedImageIndex];
    const currentImageColor = currentImage
      ? productImageColorMap[currentImage]
      : undefined;

    if (currentImageColor && currentImageColor !== effectiveSelectedColor) {
      const nextImageIndex = getFirstImageIndexForColor({
        color: effectiveSelectedColor,
        colorImages: resolvedColorImages,
        images: productGalleryImages,
      });
      // Only update when the index actually moves: if the color has no
      // matching image the resolver returns the current frame and an
      // unconditional set would re-render forever.
      if (nextImageIndex !== selectedImageIndex) {
        setSelectedImageIndex(nextImageIndex);
      }
    }
  }

  const nextAvailableCondition = resolveAvailableProductCondition({
    availableConditions,
    preferredConditions: [
      selectedCondition,
      currentVariantDisplaySelection?.condition,
    ],
  });

  if (nextAvailableCondition && nextAvailableCondition !== selectedCondition) {
    setSelectedCondition(nextAvailableCondition);
  }

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
