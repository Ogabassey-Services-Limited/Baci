'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { useV2Saved } from '../../providers/v2-saved-context';
import type { Product } from '../../types';
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
  resolveCurrentOffer,
  toRelatedProductsProduct,
} from './product-details-helpers';

export type ProductDetailsActiveTab =
  | 'compare'
  | 'description'
  | 'reviews'
  | 'specs';

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

  const buyActionHandled = useRef(false);
  const [selectedCondition, setSelectedCondition] = useState<ConditionType>(
    productData.condition || 'new'
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

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && !buyActionHandled.current) {
      buyActionHandled.current = true;
      addToCart(toRelatedProductsProduct(serverProduct), 1);
      toast({
        title: 'Added to cart',
        description: `${serverProduct.name} has been added to your cart.`,
      });
      setTimeout(() => {
        router.push(asRoute(basePath ? `${basePath}/checkout` : '/checkout'));
      }, 500);
    }
  }, [searchParams, serverProduct, addToCart, toast, router, basePath]);

  useEffect(() => {
    setSelectedCondition(productData.condition || 'new');
  }, [productData.id, productData.condition]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const currentCartItemId = buildCartItemId(productData.id, {
    color:
      selectedColor !== null ? productData.colors[selectedColor]?.name : undefined,
    condition: selectedCondition,
    storage: selectedAttributes.storage,
  });

  const cartItem = currentCartItemId
    ? cart.find((item) => item.cartItemId === currentCartItemId)
    : undefined;
  const quantityInCart = cartItem?.quantity || 0;

  useEffect(() => {
    setInputValue(quantityInCart > 0 ? String(quantityInCart) : '');
  }, [quantityInCart]);

  const currentOffer = resolveCurrentOffer(
    productData,
    selectedCondition,
    selectedAttributes
  );

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

  const handleQuantityBlur = () => {
    if (!currentCartItemId) {
      return;
    }

    let newQuantity = Number.parseInt(inputValue, 10);
    if (Number.isNaN(newQuantity) || newQuantity < 1) {
      setInputValue(String(quantityInCart));
      return;
    }

    if (newQuantity > 99) {
      newQuantity = 99;
    }

    if (newQuantity !== quantityInCart) {
      updateQuantity(currentCartItemId, newQuantity);
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

  const validateAndAddToCart = (missing = getMissingFields()) => {
    if (missing.length > 0) {
      setMissingFields(missing);
      setIsSelectionModalOpen(true);
      return false;
    }

    addToCart(
      buildCartProduct(
        productData,
        currentOffer,
        selectedImage,
        selectedCondition,
        selectedAttributes
      ),
      1,
      {
        color:
          selectedColor !== null ? productData.colors[selectedColor]?.name : undefined,
        colorValue:
          selectedColor !== null ? productData.colors[selectedColor]?.value : undefined,
        secondaryColor:
          secondaryColor !== null
            ? productData.colors[secondaryColor]?.name
            : undefined,
        secondaryColorValue:
          secondaryColor !== null
            ? productData.colors[secondaryColor]?.value
            : undefined,
        storage: selectedAttributes.storage,
        condition: selectedCondition,
        ...selectedAttributes,
      }
    );

    toast({
      title: 'Added to cart',
      description: `${productData.name} has been added to your cart.`,
      className: 'bg-white text-gray-900 border-red-600 border-2',
    });
    return true;
  };

  const handleIncrement = () => {
    if (currentCartItemId) {
      updateQuantity(currentCartItemId, quantityInCart + 1);
    }
  };

  const handleDecrement = () => {
    if (!currentCartItemId || quantityInCart <= 0) {
      return;
    }
    if (quantityInCart <= 1) {
      removeFromCart(currentCartItemId);
      return;
    }
    updateQuantity(currentCartItemId, quantityInCart - 1);
  };

  const handleToggleSaved = () => {
    toggleSaved(relatedProductsProduct);
  };

  const handleShare = async () => {
    const sharePayload = {
      title: productData.name,
      text: `Check out ${productData.name} on ${merchantName}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(sharePayload);
        return;
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(sharePayload.url);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = sharePayload.url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }

    toast({
      title: 'Link copied!',
      description: 'Product link has been copied to your clipboard.',
    });
  };

  const handleMobileAddToCart = (startRect: DOMRect) => {
    const missing = getMissingFields();
    if (missing.length === 0) {
      triggerFlyToCart(startRect);
    }
    validateAndAddToCart(missing);
  };

  const handleNegotiationSuccess = (price: number) => {
    setIsNegotiationOpen(false);

    const missing = getMissingFields();
    if (missing.length > 0) {
      setMissingFields(missing);
      setIsSelectionModalOpen(true);
      return;
    }

    validateAndAddToCart(missing);
    applyNegotiatedPrice?.(
      buildCartItemId(productData.id, {
        color:
          selectedColor !== null ? productData.colors[selectedColor]?.name : undefined,
        condition: selectedCondition,
        storage: selectedAttributes.storage,
      }),
      price
    );
  };

  return {
    activeTab,
    animatingParticles,
    basePath,
    cartHref,
    currentOffer,
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
