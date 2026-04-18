'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  getVariantConditionOptions,
  hasVariantConditionAxis,
  normalizeCanonicalProductCondition,
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
  resolveVariantSelectionParamResolution,
} from '@baci/shared/lib';
import { useCart } from '@/hooks/cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { useV2Saved } from '../../providers/v2-saved-context';
import type { Product } from '../../types';
import { createProductCartHandlers } from './product-cart-handlers';
import {
  buildCartItemId,
  buildCartProduct,
  type ConditionType,
  formatAxisLabel,
  getAxisOptions,
  getDeliveryEstimate,
  getEffectiveAxes,
  getMissingSelectionFields,
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

export function useProductDetailsState(serverProduct: Product) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const merchantContext = useMerchantSafe();
  const { addToCart, applyNegotiatedPrice, cart, removeFromCart, updateQuantity } =
    useCart();
  const { toast } = useToast();
  const { isSaved, toggleSaved } = useV2Saved();

  const basePath = merchantContext?.basePath || '';
  const merchantName =
    merchantContext?.merchant?.business_name || 'Ogabassey';
  const merchantId = merchantContext?.merchant?.id;
  const merchantSlug = merchantContext?.merchant?.slug || '';
  const productData = normalizeProductDetails(serverProduct);
  const relatedProductsProduct = toRelatedProductsProduct(serverProduct);
  const effectiveAxes = getEffectiveAxes(serverProduct, productData);
  const defaultVariantSelection = resolveDefaultVariantSelection({
    price: relatedProductsProduct.price,
    condition: productData.condition,
    manage_stock: productData.manage_stock,
    variants: productData.variants,
  });
  const usesVariantConditions = hasVariantConditionAxis({
    price: relatedProductsProduct.price,
    condition: productData.condition,
    variants: productData.variants,
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
          attributeAxes: effectiveAxes,
          condition: productData.condition,
          manage_stock: productData.manage_stock,
          price: relatedProductsProduct.price,
          variant_attributes: serverProduct.variant_attributes,
          variants: productData.variants,
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
  const initialCondition =
    routeCondition
      ? (routeCondition as ConditionType)
      : defaultVariantSelection?.condition &&
          isValidConditionParam(defaultVariantSelection.condition)
        ? (normalizeCanonicalProductCondition(
            defaultVariantSelection.condition
          ) as ConditionType)
        : (normalizeCanonicalProductCondition(productData.condition) as ConditionType) ||
          'new';
  const [selectedCondition, setSelectedCondition] = useState<ConditionType>(
    initialCondition
  );
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<number | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [activeTab, setActiveTab] =
    useState<ProductDetailsActiveTab>('description');
  const [deliveryLocation, setDeliveryLocation] = useState<
    'Lagos' | 'Outside Lagos'
  >('Lagos');
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [animatingParticles, setAnimatingParticles] = useState<DOMRect[]>([]);
  const [inputValue, setInputValue] = useState('');
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
    {
      price: relatedProductsProduct.price,
      condition: productData.condition,
      manage_stock: productData.manage_stock,
      variants: productData.variants,
    },
    {
      condition: selectedCondition,
      attributes: variantSelectionAttributes,
    }
  );
  const currentVariantSelection = resolveVariantSelection(
    {
      price: relatedProductsProduct.price,
      condition: productData.condition,
      manage_stock: productData.manage_stock,
      variants: productData.variants,
    },
    {
      condition: selectedCondition,
      attributes: variantSelectionAttributes,
    }
  );
  const currentCartVariantSelection =
    currentVariantSelection ?? currentVariantDisplaySelection;

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && !buyActionHandled.current) {
      buyActionHandled.current = true;
      const selectedVariantSelection =
        resolveVariantDisplaySelection(
          {
            price: relatedProductsProduct.price,
            condition: productData.condition,
            manage_stock: productData.manage_stock,
            variants: productData.variants,
          },
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
      setTimeout(() => {
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

  useEffect(() => {
    const seedSelection =
      resolveVariantDisplaySelection(
        {
          price: relatedProductsProduct.price,
          condition: productData.condition,
          manage_stock: productData.manage_stock,
          variants: productData.variants,
        },
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

    if (!seedSelection) {
      setSelectedColor((previousColor) =>
        previousColor === null ? previousColor : null
      );
      setSecondaryColor((previousColor) =>
        previousColor === null ? previousColor : null
      );
      setSelectedAttributes((previousAttributes) =>
        Object.keys(previousAttributes).length === 0 ? previousAttributes : {}
      );
      return;
    }

    const nextAttributes = {
      ...routeSelectionAttributes,
      ...seedSelection.attributes,
    };

    setSelectedAttributes((previousAttributes) =>
      areSelectionAttributesEqual(previousAttributes, nextAttributes)
        ? previousAttributes
        : nextAttributes
    );
    const defaultColorIndex = seedSelection.color
      ? productData.colors.findIndex(
          (color) => color.name === seedSelection.color
        )
      : -1;
    const nextColor = defaultColorIndex >= 0 ? defaultColorIndex : null;
    setSelectedColor((previousColor) =>
      previousColor === nextColor ? previousColor : nextColor
    );
    setSecondaryColor((previousColor) =>
      previousColor === null ? previousColor : null
    );
  }, [
    productData.condition,
    productData.id,
    productData.manage_stock,
    productColorsKey,
    productVariantSeedKey,
    relatedProductsProduct.price,
    routeCondition,
    routeSelectionAttributesKey,
    routeVariantId,
  ]);

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

  useEffect(() => {
    setInputValue(quantityInCart > 0 ? String(quantityInCart) : '');
  }, [quantityInCart]);

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
