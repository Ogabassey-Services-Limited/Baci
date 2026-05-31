import { resolveVariantSelectionFromImage } from '@/lib/product-image-selection';
import { stripInternalSelectionAxes } from '@/lib/product-internal-selection-axes';
import { normalizeRouteCondition } from '@/lib/product-route/normalize-route-condition';
import type { ProductCondition } from '@/types/product';
import { getFirstImageIndexForColor } from './get-first-image-index-for-color';
import type { useProductDetailRouteData } from './use-product-detail-route-data';

type RouteData = ReturnType<typeof useProductDetailRouteData>;

export function useProductDetailSelectionHandlers(routeData: RouteData) {
  const handleSelectImageIndex = (index: number) => {
    routeData.setSelectedImageIndex(index);
    if (!routeData.usesImageDrivenColorSelection) return;

    const selectedImage = routeData.productGalleryImages[index];
    const resolvedSelectionFromImage = resolveVariantSelectionFromImage({
      imageUrl: selectedImage,
      manageStock: routeData.product?.manage_stock,
      selectedAttributes: routeData.effectiveSelectedAttributes,
      selectedCondition: routeData.effectiveSelectedCondition,
      selectedStorage: routeData.effectiveSelectedStorage,
      variants: routeData.product?.variants,
    });
    const selectedImageColor =
      resolvedSelectionFromImage?.color ??
      (selectedImage
        ? routeData.productImageColorMap[selectedImage]
        : undefined);

    if (
      !selectedImageColor ||
      selectedImageColor === routeData.effectiveSelectedColor
    ) {
      return;
    }

    routeData.setHasCustomizedSelection(true);
    routeData.setSelectedVariant(resolvedSelectionFromImage?.variantId ?? null);
    routeData.setSelectedColor(selectedImageColor);
    routeData.setSelectedAttributes((current) =>
      stripInternalSelectionAxes(current)
    );
  };

  const handleSelectCondition = (condition: ProductCondition) => {
    routeData.setHasCustomizedSelection(true);
    routeData.setSelectedCondition(condition);
    if (routeData.usesVariantConditions) routeData.setSelectedVariant(null);

    const normalizedCondition = normalizeRouteCondition(condition);
    const variantsForCondition = routeData.usesVariantConditions
      ? (routeData.product?.variants ?? []).filter(
          (variant) =>
            normalizeRouteCondition(variant.condition) === normalizedCondition
        )
      : [];
    if (!routeData.usesVariantConditions || variantsForCondition.length === 0) {
      return;
    }
    const storageStillValid =
      !routeData.effectiveSelectedStorage ||
      variantsForCondition.some(
        (variant) =>
          variant.attributes?.storage === routeData.effectiveSelectedStorage
      );
    const colorStillValid =
      !routeData.effectiveSelectedColor ||
      variantsForCondition.some(
        (variant) =>
          variant.attributes?.color === routeData.effectiveSelectedColor ||
          variant.attributes?.colour === routeData.effectiveSelectedColor
      );

    if (!storageStillValid) routeData.setSelectedStorage(null);
    if (!colorStillValid) routeData.setSelectedColor(null);
    routeData.setSelectedAttributes((current) => {
      const next: Record<string, string> = {};
      let mutated = false;
      for (const [axis, value] of Object.entries(current)) {
        if (!value) {
          mutated = true;
          continue;
        }
        const stillValid = variantsForCondition.some(
          (variant) => variant.attributes?.[axis] === value
        );
        if (stillValid) next[axis] = value;
        else mutated = true;
      }
      return mutated ? next : current;
    });
  };

  return {
    handleSelectImageIndex,
    onSelectAttribute: (axis: string, value: string) => {
      routeData.setHasCustomizedSelection(true);
      routeData.setSelectedAttributes((current) => ({
        ...current,
        [axis]: value,
      }));
      routeData.setSelectedVariant(null);
    },
    onSelectColor: (color: string, imgs?: string[]) => {
      routeData.setHasCustomizedSelection(true);
      routeData.setSelectedColor(color);
      routeData.setSelectedVariant(null);
      routeData.setSelectedAttributes((current) =>
        stripInternalSelectionAxes(current)
      );
      routeData.setSelectedImageIndex(
        getFirstImageIndexForColor({
          color,
          colorImages: routeData.resolvedColorImages,
          images: imgs?.length ? imgs : routeData.productGalleryImages,
        })
      );
    },
    onSelectCondition: handleSelectCondition,
    onSelectStorage: (storage: string) => {
      routeData.setHasCustomizedSelection(true);
      routeData.setSelectedStorage(storage);
      routeData.setSelectedVariant(null);
    },
    onSetSelectedVariant: (variantId: string) => {
      routeData.setHasCustomizedSelection(true);
      routeData.setSelectedVariant(variantId);
    },
  };
}
