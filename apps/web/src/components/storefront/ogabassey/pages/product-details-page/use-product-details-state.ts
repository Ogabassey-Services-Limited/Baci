'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  getVariantConditionOptions,
  hasVariantConditionAxis,
  resolveDefaultVariantSelection,
  resolveVariantDisplaySelection,
  resolveVariantSelection,
  resolveVariantSelectionParamResolution,
} from '@baci/shared/lib';
import { useCart } from '@/hooks/use-cart';
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
  'refurbished',
]);

function isValidConditionParam(value: string): value is ConditionType {
  return VALID_CONDITIONS.has(value as ConditionType);
}

function getValidAvailableConditions(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is ConditionType => !!value && isValidConditionParam(value)))
  );
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
  const routeCondition =
    routeConditionSource && isValidConditionParam(routeConditionSource)
      ? routeConditionSource
      : undefined;
  const routeVariantId =
    usesVariantRouteSelection && routeSelectionInput.variantId
      ? routeSelectionInput.variantId
      : undefined;
  const initialCondition =
    routeCondition
      ? routeCondition
      : defaultVariantSelection?.condition &&
          isValidConditionParam(defaultVariantSelection.condition)
        ? defaultVariantSelection.condition
        : productData.condition || 'new';
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
      variantId: routeVariantId,
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
      variantId: routeVariantId,
    }
  );

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && !buyActionHandled.current) {
      buyActionHandled.current = true;
      const defaultAttributes = defaultVariantSelection?.attributes || {};
      const defaultColorIndex =
        defaultVariantSelection?.color != null
          ? productData.colors.findIndex(
              (color) => color.name === defaultVariantSelection.color
            )
          : -1;
      addToCart(
        buildCartProduct(
          productData,
          resolveCurrentOffer(
            productData,
            (defaultVariantSelection?.condition as ConditionType | undefined) ||
              'new',
            defaultAttributes,
            defaultVariantSelection
          ),
          defaultColorIndex >= 0 ? defaultColorIndex : 0,
          (defaultVariantSelection?.condition as ConditionType | undefined) ||
            'new',
          defaultAttributes
        ),
        1,
        {
          ...defaultAttributes,
          variantId: defaultVariantSelection?.variant.id,
          variantAttributes: defaultAttributes,
          color: defaultVariantSelection?.color,
          storage: defaultVariantSelection?.storage,
          condition:
            (defaultVariantSelection?.condition as ConditionType | undefined) ||
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
      routeCondition
        ? routeCondition
        : (seedSelection?.condition as ConditionType | undefined) ||
            productData.condition ||
            'new'
    );

    if (!seedSelection) {
      setSelectedColor(null);
      setSecondaryColor(null);
      setSelectedAttributes({});
      return;
    }

    setSelectedAttributes({
      ...routeSelectionAttributes,
      ...seedSelection.attributes,
    });
    const defaultColorIndex = seedSelection.color
      ? productData.colors.findIndex(
          (color) => color.name === seedSelection.color
        )
      : -1;
    setSelectedColor(defaultColorIndex >= 0 ? defaultColorIndex : null);
    setSecondaryColor(null);
  }, [
    defaultVariantSelection,
    productData.condition,
    productData.colors,
    productData.id,
    productData.manage_stock,
    productData.variants,
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
    variantId: currentVariantDisplaySelection?.variant.id,
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
  const canPurchase =
    (productData.variants?.length ?? 0) > 0
      ? Boolean(currentVariantSelection) && currentOffer.stock > 0
      : currentOffer.stock > 0;

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
    currentOffer,
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
    selectedVariantId: currentVariantSelection?.variant.id,
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
