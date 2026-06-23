'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  type ResolvedProductVariantSelection,
  getVariantConditionOptions,
  hasVariantConditionAxis,
  normalizeCanonicalProductCondition,
  resolveDefaultVariantSelection,
  resolveLowestPricedVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
  resolveVariantSelectionParamResolution,
} from '@baci/shared/lib';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/merchant/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { useV2Saved } from '../../providers/v2-saved-context';
import type { Product } from '../../types';
import { createProductCartHandlers } from './product-cart-handlers';
import {
  applySingleOptionAxisSelectionsToVariants,
  buildCartItemId,
  buildCartProduct,
  type ConditionType,
  formatAxisLabel,
  getAxisOptions,
  getDeliveryEstimate,
  getEffectiveAxes,
  getMissingSelectionFields,
  getSingleOptionAxisSelections,
  normalizeProductDetails,
  toRelatedProductsProduct,
} from './product-details-helpers';
import { resolveCurrentOffer } from './offer-resolution';
import { shareProductLink } from './product-share';

export type ProductDetailsActiveTab =
  | 'compare'
  | 'description'
  | 'reviews'
  | 'specs';

const VALID_CONDITIONS: ReadonlySet<ConditionType> = new Set<ConditionType>([
  'new',
  'used',
  'open_box',
]);

function isValidConditionParam(value: string): value is ConditionType {
  const normalized = normalizeCanonicalProductCondition(value);
  return normalized !== '' && VALID_CONDITIONS.has(normalized);
}

function getValidAvailableConditions(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeCanonicalProductCondition(value))
        .filter(
          (value): value is ConditionType =>
            value !== '' && VALID_CONDITIONS.has(value)
        )
    )
  );
}

function areSelectionAttributesEqual(
  left: Record<string, string>,
  right: Record<string, string>
) {
  const leftEntries = Object.entries(left);
  const rightEntries = Object.entries(right);

  if (leftEntries.length !== rightEntries.length) {
    return false;
  }

  return leftEntries.every(([key, value]) => right[key] === value);
}

type ProductVariantSelection =
  | ResolvedProductVariantSelection<NonNullable<Product['variants']>[number]>
  | null;

function getSelectionColor(selection: ProductVariantSelection) {
  return (
    selection?.color ||
    selection?.attributes?.color ||
    selection?.attributes?.Colour ||
    selection?.attributes?.colour ||
    undefined
  );
}

function getSelectionImageIndex(
  productData: ReturnType<typeof normalizeProductDetails>,
  selection: ProductVariantSelection
) {
  const selectionColor = getSelectionColor(selection);
  const colorImage = selectionColor
    ? productData.colorImages[selectionColor]?.[0]
    : undefined;
  const variantImage = selection?.variant.images?.find(Boolean);
  const image = colorImage || variantImage;

  if (!image) {
    return 0;
  }

  const imageIndex = productData.images.findIndex((item) => item === image);
  return imageIndex >= 0 ? imageIndex : 0;
}

export function useProductDetailsState(serverProduct: Product) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const merchantContext = useMerchantSafe();
  const { addToCart, applyNegotiatedPrice, cart, removeFromCart, updateQuantity } =
    useCart();
  const { toast } = useToast();
  const { isSaved, toggleSaved } = useV2Saved();
  const checkoutRedirectTimeoutRef = useRef<number | null>(null);

  const basePath = merchantContext?.basePath || '';
  const merchantName =
    merchantContext?.merchant?.business_name || 'Ogabassey';
  const merchantId = merchantContext?.merchant?.id;
  const merchantSlug = merchantContext?.merchant?.slug || '';
  const merchantVatRate =
    merchantContext?.merchant?.vat_registration_status === 'registered'
      ? (merchantContext.merchant.vat_rate ?? 7.5) / 100
      : 0;
  const productData = normalizeProductDetails(serverProduct);
  const relatedProductsProduct = toRelatedProductsProduct(serverProduct);
  const effectiveAxes = getEffectiveAxes(serverProduct, productData);
  const singleOptionAxisSelections = getSingleOptionAxisSelections(
    productData,
    effectiveAxes
  );
  const variantResolutionVariants = applySingleOptionAxisSelectionsToVariants(
    productData.variants,
    singleOptionAxisSelections
  );
  const variantResolutionProduct = {
    price: relatedProductsProduct.price,
    condition: productData.condition,
    manage_stock: productData.manage_stock,
    variants: variantResolutionVariants,
  };
  // The PDP opens on the cheapest buyable variant (price-first, ignoring
  // condition preference) so e.g. a cheaper "Used" leads over a pricier "Open
  // Box". Falls back to the shared condition-first default when nothing is
  // purchasable. This is PDP-only — feeds/cart keep the shared resolver.
  const defaultVariantSelection =
    resolveLowestPricedVariantSelection({ ...variantResolutionProduct }) ??
    resolveDefaultVariantSelection({ ...variantResolutionProduct });
  const usesVariantConditions = hasVariantConditionAxis({
    ...variantResolutionProduct,
  });
  const availableConditions = usesVariantConditions
    ? getValidAvailableConditions(
        getVariantConditionOptions({
          price: relatedProductsProduct.price,
          condition: productData.condition,
          variants: productData.variants,
        })
      )
    : getValidAvailableConditions(
        [
          productData.condition,
          ...(productData.offers?.map((offer) => offer.condition) || []),
        ]
      );
  const buyActionHandled = useRef(false);
  const rawConditionParam = searchParams.get('condition');
  const usesVariantRouteSelection = Boolean(productData.variants?.length);
  const routeSelectionResolution = usesVariantRouteSelection
    ? resolveVariantSelectionParamResolution(
        {
          ...variantResolutionProduct,
          attributeAxes: effectiveAxes,
          variant_attributes: serverProduct.variant_attributes,
        },
        searchParams
      )
    : null;
  const routeSelectionInput = routeSelectionResolution?.selectionInput ?? {};
  const routeSelectionAttributes = routeSelectionInput.attributes || {};
  const routeSelectionAttributesKey = JSON.stringify(routeSelectionAttributes);
  const routeConditionSource =
    routeSelectionInput.condition ??
    (!usesVariantRouteSelection ? rawConditionParam : undefined);
  const routeCondition = normalizeCanonicalProductCondition(routeConditionSource);
  const routeVariantId =
    usesVariantRouteSelection && routeSelectionInput.variantId
      ? routeSelectionInput.variantId
      : undefined;
  const productColorsKey = JSON.stringify(
    productData.colors.map((color) => color.name)
  );
  const productVariantSeedKey = JSON.stringify(
    (productData.variants ?? []).map((variant) => ({
      attributes: variant.attributes ?? {},
      condition: variant.condition ?? null,
      id: variant.id ?? null,
      price_override: variant.price_override ?? null,
      stock_quantity: variant.stock_quantity ?? null,
    }))
  );
  const selectionSeedKey = JSON.stringify([
    productData.condition,
    productData.id,
    productData.manage_stock ?? null,
    productColorsKey,
    productVariantSeedKey,
    relatedProductsProduct.price,
    routeCondition,
    routeSelectionAttributesKey,
    routeVariantId ?? null,
  ]);
  // Resolve the initial variant selection at render time (not in an effect) so
  // the very first render — including server-side render and pre-hydration
  // markup — already has a concrete variant selected. Previously we seeded
  // from a `useEffect`, which meant the mobile action bar rendered "Out of
  // Stock" in SSR HTML before hydration could swap it to "Add to Cart".
  // Route-param/product changes re-apply the seed via a render-time
  // prev-key comparison further down; its equality checks bail out when
  // state already matches (no wasted renders).
  // Each `useState` uses a lazy initializer so the seed resolution runs once
  // on mount instead of on every render.
  const resolveInitialSeed = () =>
    resolveVariantDisplaySelection(
      variantResolutionProduct,
      {
        attributes: routeSelectionAttributes,
        condition: routeCondition,
        variantId: routeVariantId,
      }
    ) ?? defaultVariantSelection;
  const [selectedCondition, setSelectedCondition] = useState<ConditionType>(
    () => {
      const seed = resolveInitialSeed();
      return routeCondition
        ? (routeCondition as ConditionType)
        : seed?.condition && isValidConditionParam(seed.condition)
          ? (normalizeCanonicalProductCondition(seed.condition) as ConditionType)
          : (normalizeCanonicalProductCondition(
              productData.condition
            ) as ConditionType) || 'new';
    }
  );
  const [selectedImage, setSelectedImage] = useState(() =>
    getSelectionImageIndex(productData, resolveInitialSeed())
  );
  const [selectedColor, setSelectedColor] = useState<number | null>(() => {
    const seed = resolveInitialSeed();
    const index = seed?.color
      ? productData.colors.findIndex((color) => color.name === seed.color)
      : -1;
    return index >= 0 ? index : null;
  });
  const [secondaryColor, setSecondaryColor] = useState<number | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >(() => {
    const seed = resolveInitialSeed();
    return seed
      ? {
          ...singleOptionAxisSelections,
          ...routeSelectionAttributes,
          ...seed.attributes,
        }
      : { ...singleOptionAxisSelections, ...routeSelectionAttributes };
  });
  const [activeTab, setActiveTab] =
    useState<ProductDetailsActiveTab>('description');
  const [deliveryLocation, setDeliveryLocation] = useState<
    'Lagos' | 'Outside Lagos'
  >('Lagos');
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [animatingParticles, setAnimatingParticles] = useState<DOMRect[]>([]);
  const selectedColorName =
    selectedColor !== null
      ? productData.colors[selectedColor]?.name
      : routeSelectionAttributes.color;
  const variantSelectionAttributes = {
    ...routeSelectionAttributes,
    ...selectedAttributes,
    ...(selectedColorName ? { color: selectedColorName } : {}),
  };
  const currentVariantDisplaySelection = resolveVariantDisplaySelection(
    variantResolutionProduct,
    {
      condition: selectedCondition,
      attributes: variantSelectionAttributes,
    }
  );
  const currentVariantSelection = resolveVariantSelection(
    variantResolutionProduct,
    {
      condition: selectedCondition,
      attributes: variantSelectionAttributes,
    }
  );
  const currentCartVariantSelection =
    currentVariantSelection ?? currentVariantDisplaySelection;

  useEffect(() => {
    return () => {
      if (checkoutRedirectTimeoutRef.current !== null) {
        window.clearTimeout(checkoutRedirectTimeoutRef.current);
        checkoutRedirectTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && !buyActionHandled.current) {
      buyActionHandled.current = true;
      const selectedVariantSelection =
        resolveVariantDisplaySelection(
          variantResolutionProduct,
          {
            attributes: routeSelectionAttributes,
            condition: routeCondition,
            variantId: routeVariantId,
          }
        ) ?? defaultVariantSelection;
      const selectedAttributesForBuy = selectedVariantSelection?.attributes || {};
      const defaultColorIndex =
        selectedVariantSelection?.color != null
          ? productData.colors.findIndex(
              (color) => color.name === selectedVariantSelection.color
            )
          : -1;
      addToCart(
        buildCartProduct(
          productData,
          resolveCurrentOffer(
            productData,
            (selectedVariantSelection?.condition as ConditionType | undefined) ||
              'new',
            selectedAttributesForBuy,
            selectedVariantSelection
          ),
          defaultColorIndex >= 0 ? defaultColorIndex : 0,
          (selectedVariantSelection?.condition as ConditionType | undefined) ||
            'new',
          selectedAttributesForBuy
        ),
        1,
        {
          ...selectedAttributesForBuy,
          variantId: selectedVariantSelection?.variant.id,
          variantAttributes: selectedAttributesForBuy,
          color: selectedVariantSelection?.color,
          storage: selectedVariantSelection?.storage,
          condition:
            (selectedVariantSelection?.condition as ConditionType | undefined) ||
            'new',
        }
      );
      toast({
        title: 'Added to cart',
        description: `${serverProduct.name} has been added to your cart.`,
      });
      if (checkoutRedirectTimeoutRef.current !== null) {
        window.clearTimeout(checkoutRedirectTimeoutRef.current);
      }
      checkoutRedirectTimeoutRef.current = window.setTimeout(() => {
        checkoutRedirectTimeoutRef.current = null;
        router.push(asRoute(basePath ? `${basePath}/checkout` : '/checkout'));
      }, 500);
    }
  }, [
    searchParams,
    serverProduct,
    addToCart,
    toast,
    router,
    basePath,
    defaultVariantSelection,
    productData,
  ]);

  // Re-apply the seed selection during render (prev-key comparison) when the
  // product or route selection params change, instead of routing the sync
  // through a useEffect. React re-renders immediately before commit, so
  // shoppers never see a one-frame-stale selection between two commits.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [appliedSelectionSeedKey, setAppliedSelectionSeedKey] =
    useState(selectionSeedKey);
  if (selectionSeedKey !== appliedSelectionSeedKey) {
    setAppliedSelectionSeedKey(selectionSeedKey);

    const seedSelection =
      resolveVariantDisplaySelection(
        variantResolutionProduct,
        {
          attributes: routeSelectionAttributes,
          condition: routeCondition,
          variantId: routeVariantId,
        }
      ) ?? defaultVariantSelection;

    setSelectedCondition(
      (previousCondition) => {
        const nextCondition =
          routeCondition
            ? routeCondition
            : (seedSelection?.condition as ConditionType | undefined) ||
              productData.condition ||
              'new';

        return previousCondition === nextCondition
          ? previousCondition
          : nextCondition;
      }
    );

    if (seedSelection) {
      const nextAttributes = {
        ...singleOptionAxisSelections,
        ...routeSelectionAttributes,
        ...seedSelection.attributes,
      };

      setSelectedAttributes((previousAttributes) =>
        areSelectionAttributesEqual(previousAttributes, nextAttributes)
          ? previousAttributes
          : nextAttributes
      );
      const seedColor = getSelectionColor(seedSelection);
      const defaultColorIndex = seedColor
        ? productData.colors.findIndex((color) => color.name === seedColor)
        : -1;
      const nextImage = getSelectionImageIndex(productData, seedSelection);
      const nextColor = defaultColorIndex >= 0 ? defaultColorIndex : null;
      setSelectedColor((previousColor) =>
        previousColor === nextColor ? previousColor : nextColor
      );
      setSelectedImage((previousImage) =>
        previousImage === nextImage ? previousImage : nextImage
      );
      setSecondaryColor((previousColor) =>
        previousColor === null ? previousColor : null
      );
    } else {
      const nextAttributes = {
        ...singleOptionAxisSelections,
        ...routeSelectionAttributes,
      };

      setSelectedColor((previousColor) =>
        previousColor === null ? previousColor : null
      );
      setSelectedImage((previousImage) =>
        previousImage === 0 ? previousImage : 0
      );
      setSecondaryColor((previousColor) =>
        previousColor === null ? previousColor : null
      );
      setSelectedAttributes((previousAttributes) =>
        areSelectionAttributesEqual(previousAttributes, nextAttributes)
          ? previousAttributes
          : nextAttributes
      );
    }
  }

  const currentCartItemId = buildCartItemId(productData.id, {
    color:
      selectedColor !== null ? productData.colors[selectedColor]?.name : undefined,
    secondaryColor:
      secondaryColor !== null ? productData.colors[secondaryColor]?.name : undefined,
    condition: selectedCondition,
    variantId: currentCartVariantSelection?.variant.id,
    selectedAttributes,
  });

  const cartItem = currentCartItemId
    ? cart.find((item) => {
        if (item.cartItemId === currentCartItemId) return true;
        // Legacy fallback: match items stored with old - separator format
        if (item.cartItemId && item.cartItemId.includes('-') && !item.cartItemId.includes('::') && item.id === productData.id) {
          return true;
        }
        return false;
      })
    : undefined;
  const quantityInCart = cartItem?.quantity || 0;

  // Mirror the cart quantity into the editable input during render (prev-value
  // comparison) instead of an effect, so the input never shows a stale
  // quantity for a frame after the cart changes.
  const [inputValue, setInputValue] = useState(() =>
    quantityInCart > 0 ? String(quantityInCart) : ''
  );
  const [prevQuantityInCart, setPrevQuantityInCart] = useState(quantityInCart);
  if (quantityInCart !== prevQuantityInCart) {
    setPrevQuantityInCart(quantityInCart);
    setInputValue(quantityInCart > 0 ? String(quantityInCart) : '');
  }

  const currentOffer = resolveCurrentOffer(
    productData,
    selectedCondition,
    variantSelectionAttributes,
    currentVariantDisplaySelection
  );
  const currentCartOffer = resolveCurrentOffer(
    productData,
    selectedCondition,
    variantSelectionAttributes,
    currentCartVariantSelection
  );
  const managesStock = productData.manage_stock !== false;
  const canPurchase =
    (productData.variants?.length ?? 0) > 0
      ? Boolean(currentVariantSelection) &&
        (!managesStock || currentCartOffer.stock > 0)
      : !managesStock || currentOffer.stock > 0;

  const normalizedReviewRating = Math.max(
    0,
    Math.min(Number(productData.rating) || 0, 5)
  );
  const normalizedReviewRatingWidth = `${(normalizedReviewRating / 5) * 100}%`;

  const isLiked = isSaved(productData.id);
  const cartHref = asRoute(basePath ? `${basePath}/cart` : '/cart');
  const homeHref = asRoute(basePath || '');

  const triggerFlyToCart = (startRect: DOMRect) => {
    setAnimatingParticles((prev) => [...prev, startRect]);
  };

  const handleAnimationComplete = () => {
    setAnimatingParticles((prev) => prev.slice(1));
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setInputValue(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      (event.target as HTMLInputElement).blur();
    }
  };

  const handleColorSelection = (index: number) => {
    if (selectedColor === index) {
      setSelectedColor(null);
      setSecondaryColor(null);
      return;
    }

    setSelectedColor(index);
    if (secondaryColor === index) {
      setSecondaryColor(null);
    }

    const colorName = productData.colors[index]?.name;
    const colorImage = colorName ? productData.colorImages[colorName]?.[0] : undefined;
    if (colorImage) {
      const imageIndex = productData.images.findIndex((image) => image === colorImage);
      setSelectedImage(imageIndex >= 0 ? imageIndex : 0);
      return;
    }

    setSelectedImage(index < productData.images.length ? index : 0);
  };

  const handleColorDoubleClick = (index: number) => {
    if (selectedColor === null) {
      return;
    }
    if (secondaryColor === index) {
      setSecondaryColor(null);
    } else if (selectedColor !== index) {
      setSecondaryColor(index);
    }
  };

  const getMissingFields = () =>
    getMissingSelectionFields(
      productData,
      effectiveAxes,
      selectedColor,
      selectedAttributes
    );

  const handleToggleSaved = () => {
    toggleSaved(serverProduct);
  };

  const handleShare = async () => {
    await shareProductLink({
      merchantName,
      productName: productData.name,
      toast,
      url: window.location.href,
    });
  };

  const {
    handleDecrement,
    handleIncrement,
    handleMobileAddToCart,
    handleNegotiationSuccess,
    handleQuantityBlur,
    validateAndAddToCart,
  } = createProductCartHandlers({
    addToCart,
    applyNegotiatedPrice,
    currentCartItemId,
    currentOffer: currentCartOffer,
    getMissingFields,
    inputValue,
    productData,
    quantityInCart,
    removeFromCart,
    secondaryColor,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedImage,
    selectedVariantId: currentCartVariantSelection?.variant.id,
    canPurchase,
    setInputValue,
    setIsNegotiationOpen,
    setIsSelectionModalOpen,
    setMissingFields,
    toast,
    triggerFlyToCart,
    updateQuantity,
  });

  return {
    activeTab,
    availableConditions,
    animatingParticles,
    basePath,
    canPurchase,
    cartHref,
    currentOffer,
    currentVariantDisplaySelection,
    deliveryEstimate: getDeliveryEstimate(deliveryLocation),
    deliveryLocation,
    effectiveAxes,
    formatAxisLabel,
    getAxisOptions: (axis: string) => getAxisOptions(axis, productData),
    handleAnimationComplete,
    handleColorDoubleClick,
    handleColorSelection,
    handleDecrement,
    handleIncrement,
    handleKeyDown,
    handleMobileAddToCart,
    handleNegotiationSuccess,
    handleQuantityBlur,
    handleQuantityChange,
    handleShare,
    handleToggleSaved,
    homeHref,
    inputValue,
    isLiked,
    isNegotiationOpen,
    isSelectionModalOpen,
    merchantId,
    merchantSlug,
    merchantVatRate,
    missingFields,
    normalizedReviewRatingWidth,
    productData,
    quantityInCart,
    relatedProductsProduct,
    secondaryColor,
    selectedAttributes,
    selectedColor,
    selectedCondition,
    selectedImage,
    setActiveTab,
    setDeliveryLocation,
    setIsNegotiationOpen,
    setIsSelectionModalOpen,
    setMissingFields,
    setSelectedAttributes,
    setSelectedColor,
    setSelectedCondition,
    setSelectedImage,
    showColorToast: false,
    validateAndAddToCart,
  };
}
