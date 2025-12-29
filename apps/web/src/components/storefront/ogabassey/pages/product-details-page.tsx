'use client';
// Migrated from temp-source/components/ProductDetails.tsx
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  ChevronRight,
  HandCoins,
  Heart,
  Info,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  ShieldPlus,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  User,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandProducts } from '@/components/storefront/brand-products';
import { PriceRangeProducts } from '@/components/storefront/price-range-products';
import { useCart } from '@/hooks/use-cart';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { asRoute } from '@/lib/routes';
import { sanitizeHtml } from '@/lib/sanitize';
import { AdUnit } from '../components/AdUnit';
import { BannerCarousel } from '../components/BannerCarousel';
import { BlogSnippet } from '../components/BlogSnippet';
import { NegotiationModal } from '../components/NegotiationModal';
import { ProductComparisonTable } from '../components/ProductComparisonTable';
import { ProductVideo } from '../components/ProductVideo';
import { FlyToCartAnimation } from '../components/FlyToCartAnimation'; // Added Animation
import { useV2Comparison } from '../providers/v2-comparison-context';
import { useV2Saved } from '../providers/v2-saved-context';
import type { Product } from '../types';

// Props interface for the component
interface ProductDetailsPageProps {
  /** Server-fetched product data - required */
  product: Product;
}

export const ProductDetailsPage: React.FC<ProductDetailsPageProps> = ({ product: serverProduct }) => {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = serverProduct?.id?.toString() || (params?.id as string); // Use prop id or URL param
  const router = useRouter(); // Use Next.js router
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath || '';
  const getHref = (path: string) => path.startsWith('http') ? path : `${basePath}${path}`;
  const {
    addToCart,
    cart,
    updateQuantity,
    removeFromCart,
    setIsCartOpen,
    applyNegotiatedPrice,
  } = useCart();
  const { toast } = useToast();
  const { toggleSaved, isSaved } = useV2Saved();
  const { compareItems, addToCompare, removeFromCompare, isInCompare } =
    useV2Comparison();

  // Handle ?action=buy from ChatGPT widget - auto add to cart and go to checkout
  const buyActionHandled = useRef(false);
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'buy' && serverProduct && !buyActionHandled.current) {
      buyActionHandled.current = true;
      // Add to cart
      addToCart(serverProduct as any, 1);
      toast({
        title: 'Added to cart',
        description: `${serverProduct.name} has been added to your cart.`,
      });
      // Redirect to checkout after a short delay
      setTimeout(() => {
        router.push(asRoute(getHref('/checkout')));
      }, 500);
    }
  }, [searchParams, serverProduct, addToCart, toast, router, getHref]);

  const getColorHex = (name: string) => {
    const lower = name.toLowerCase();
    if (
      lower.includes('black') ||
      lower.includes('obsidian') ||
      lower.includes('midnight') ||
      lower.includes('graphite') ||
      lower.includes('space grey')
    )
      return '#1a1a1a';
    if (
      lower.includes('white') ||
      lower.includes('starlight') ||
      lower.includes('porcelain')
    )
      return '#f2f2f2';
    if (
      lower.includes('blue') ||
      lower.includes('bay') ||
      lower.includes('pacific')
    )
      return '#2f3d4d';
    if (
      lower.includes('natural') ||
      lower.includes('grey') ||
      lower.includes('gray')
    )
      return '#808080';
    if (lower.includes('silver')) return '#e0e0e0';
    if (lower.includes('gold')) return '#F5E0C3';
    return '#cccccc';
  };

  const productData = useMemo(() => {
    // Get color_images if available
    const colorImages = (serverProduct as Product & { color_images?: Record<string, string[]> }).color_images;

    // Normalize Colors - derive from color_images keys if available, otherwise use colors array
    let normalizedColors: { name: string; value: string }[] = [];
    if (colorImages && Object.keys(colorImages).length > 0) {
      // Derive colors from color_images keys
      normalizedColors = Object.keys(colorImages).map((colorName) => ({
        name: colorName,
        value: getColorHex(colorName),
      }));
    } else if (serverProduct.colors && serverProduct.colors.length > 0) {
      normalizedColors = serverProduct.colors.map((c: unknown) => ({
        name: typeof c === 'string' ? c : (c as { name?: string }).name || String(c),
        value: getColorHex(typeof c === 'string' ? c : (c as { name?: string }).name || String(c)),
      }));
    }

    // Normalize Storage
    let normalizedStorage: string[] = [];
    if (serverProduct.storage) {
      normalizedStorage = Array.isArray(serverProduct.storage)
        ? serverProduct.storage
        : [serverProduct.storage];
    }

    // Normalize Images - merge color images into the images array
    let normalizedImages: string[] = [];
    if (serverProduct.images && serverProduct.images.length > 0) {
      normalizedImages = [...serverProduct.images];
    } else if (serverProduct.image) {
      normalizedImages = [serverProduct.image];
    }

    // Add color images to the images array if not already present
    if (colorImages) {
      for (const colorImageArray of Object.values(colorImages)) {
        for (const img of colorImageArray) {
          if (!normalizedImages.includes(img)) {
            normalizedImages.push(img);
          }
        }
      }
    }

    // Extract platforms - check variant_attributes first (consolidated), then variants
    const variantAttrs = (serverProduct as Product & { variant_attributes?: Record<string, string[]> }).variant_attributes;
    let platforms: string[] = [];
    if (variantAttrs?.Platform && variantAttrs.Platform.length > 0) {
      platforms = variantAttrs.Platform;
    } else if (serverProduct.variants) {
      platforms = Array.from(new Set(serverProduct.variants
        .map((v) => v.attributes?.platform || v.platform)
        .filter(Boolean))) as string[];
    }

    return {
      ...serverProduct,
      images: normalizedImages,
      colors: normalizedColors,
      storage: normalizedStorage,
      platforms,
      colorImages: colorImages || {},
      condition: serverProduct.condition || 'new',
      rating: serverProduct.rating || 0,
      reviewCount: serverProduct.reviews || 0,
      description: serverProduct.description || 'No description available.',
      detailedSpecs: (Array.isArray((serverProduct as Product & { specifications?: unknown }).specifications)
        ? (serverProduct as Product & { specifications?: unknown }).specifications
        : Array.isArray(serverProduct.detailedSpecs)
          ? serverProduct.detailedSpecs
          : [
            {
              category: 'General',
              items: [
                { label: 'Brand', value: serverProduct.brand || 'Generic' },
                { label: 'Condition', value: serverProduct.condition || 'New' },
                { label: 'Category', value: serverProduct.categories?.name || (serverProduct as any).category || 'General' },
              ],
            },
          ]) as { category: string; items: { label: string; value: string }[] }[],
      specs: serverProduct.specs || [
        { label: 'Brand', value: serverProduct.brand || 'Generic' },
        { label: 'Condition', value: serverProduct.condition || 'New' },
      ],
    };
  }, [serverProduct, getColorHex]);

  // Phase 7: Condition State
  type ConditionType = 'new' | 'used' | 'open_box' | 'refurbished';
  const [selectedCondition, setSelectedCondition] = useState<ConditionType>(
    (productData.condition as ConditionType) || 'new'
  );

  // Update selected condition if product changes
  useEffect(() => {
    if (productData.condition) {
      setSelectedCondition(productData.condition as ConditionType);
    }
  }, [productData.id, productData.condition]);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<number | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'description' | 'specs' | 'reviews' | 'compare'
  >('description');
  const [deliveryLocation, setDeliveryLocation] = useState<
    'Lagos' | 'Outside Lagos'
  >('Lagos');
  const [showColorToast, setShowColorToast] = useState(false);

  // Negotiation Logic
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);

  // Selection Logic
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Animation State
  const [animatingParticles, setAnimatingParticles] = useState<DOMRect[]>([]);

  const triggerFlyToCart = (startRect: DOMRect) => {
    setAnimatingParticles((prev) => [...prev, startRect]);
  };

  const handleAnimationComplete = () => {
    setAnimatingParticles((prev) => prev.slice(1));
  };


  // Comparison Logic - Compute comparable items
  const comparableProducts = useMemo(() => {
    // Get items from context that match category AND are NOT the current product
    const categoryToMatch = productData.categories?.name || (productData as any).category;
    return compareItems
      .filter(
        (p) => {
          const pCategory = (p as any).categories?.name || (p as any).category;
          return pCategory === categoryToMatch && String(p.id) !== String(productData.id);
        }
      )
      .slice(0, 3); // Max 3 competitors
  }, [compareItems, productData.categories?.name, productData.id]);

  // Scroll to top on load - Optional in Next.js but kept for component mount reset
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const isLiked = isSaved(productData.id);

  // Derived state to find if this exact variant is in cart
  // Must match generateCartItemId format: [productId, color?, storage?].join('-')
  const currentCartItemId = useMemo(() => {
    const parts: string[] = [String(productData.id)];
    if (selectedColor !== null && productData.colors[selectedColor]) {
      parts.push(productData.colors[selectedColor].name);
    }
    if (selectedStorage !== null && productData.storage[selectedStorage]) {
      parts.push(productData.storage[selectedStorage]);
    }
    // Include condition to match use-cart generateCartItemId
    if (selectedCondition) {
      parts.push(selectedCondition);
    }
    return parts.join('-');
  }, [productData.id, productData.colors, productData.storage, selectedColor, selectedStorage, selectedCondition]);

  const cartItem = currentCartItemId
    ? cart.find((item) => item.cartItemId === currentCartItemId)
    : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Local state for editable quantity input
  const [inputValue, setInputValue] = useState('');

  // Sync input value with cart quantity when it changes
  useEffect(() => {
    if (quantityInCart > 0) {
      setInputValue(quantityInCart.toString());
    } else {
      setInputValue('');
    }
  }, [quantityInCart]);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty string to let user delete content
    const val = e.target.value;
    // Only allow numeric input
    if (val === '' || /^\d+$/.test(val)) {
      setInputValue(val);
    }
  };

  const handleQuantityBlur = () => {
    if (!currentCartItemId) return;

    let newQuantity = parseInt(inputValue, 10);

    // If empty or invalid or 0, revert to current cart quantity or 1
    if (isNaN(newQuantity) || newQuantity < 1) {
      // Revert to current known good state
      setInputValue(quantityInCart.toString());
      return;
    }

    // Determine simplified max limit (optional, e.g. 99)
    if (newQuantity > 99) newQuantity = 99;

    // Only call update if value actually changed
    if (newQuantity !== quantityInCart) {
      updateQuantity(currentCartItemId, newQuantity);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleColorSelection = (idx: number) => {
    // Single click: Select/Deselect Primary Color
    if (selectedColor === idx) {
      setSelectedColor(null);
      setSecondaryColor(null); // Clear secondary if primary is deselected
      return;
    }

    // If setting a new primary color
    setSelectedColor(idx);
    // If the new primary color is the same as the current secondary, clear secondary
    if (secondaryColor === idx) {
      setSecondaryColor(null);
    }

    // Use color_images mapping if available, otherwise fall back to index-based
    const colorName = productData.colors[idx]?.name;
    const colorImages = productData.colorImages as Record<string, string[]> | undefined;

    if (colorImages && colorName && colorImages[colorName]?.length > 0) {
      // Find the first image for this color in the main images array
      const colorImage = colorImages[colorName][0];
      const imageIndex = productData.images.findIndex((img: string) => img === colorImage);
      setSelectedImage(imageIndex >= 0 ? imageIndex : 0);
    } else {
      // Fallback to index-based mapping
      setSelectedImage(idx < productData.images.length ? idx : 0);
    }
  };

  const handleColorDoubleClick = (idx: number) => {
    // Double click: Toggle Secondary Color
    if (selectedColor === null) {
      // If no primary is selected, double-click does nothing for secondary
      return;
    }
    if (secondaryColor === idx) {
      setSecondaryColor(null);
    } else if (selectedColor !== idx) {
      // Must be different from primary
      setSecondaryColor(idx);
    }
  };

  // Phase 7 & 4: Get Current Offer Data (Price, Stock) based on Condition AND Variants
  const currentOffer = useMemo(() => {
    let price = productData.rawPrice || 0;
    // Attempt to parse price string if rawPrice is missing (fallback)
    if (!price && typeof productData.price === 'string') {
      price = parseInt(productData.price.replace(/[^0-9]/g, ''), 10) || 0;
    }

    let stock = productData.stock ?? 10;

    // 1. Resolve Base Price based on Condition
    // If selected is NOT main condition, look for offer
    if (selectedCondition.toLowerCase() !== (productData.condition || 'new').toLowerCase()) {
      if (productData.offers) {
        const offer = productData.offers.find(o => o.condition.toLowerCase() === selectedCondition.toLowerCase());
        if (offer) {
          price = offer.rawPrice;
          stock = offer.stock ?? offer.stock_quantity ?? stock;
        }
      }
    }

    // 2. Resolve Variant Price Modifier / Override based on Storage
    // This applies ON TOP of condition price (or overrides it if price_override is set)
    if (selectedStorage !== null && productData.storage && Array.isArray(productData.storage) && productData.variants) {
      const storageValue = productData.storage[selectedStorage];
      const variant = productData.variants.find(v => v.storage === storageValue);

      if (variant) {
        if (variant.price_override) {
          price = variant.price_override;
        } else if (variant.price_modifier) {
          price += variant.price_modifier;
        }

        if (variant.stock !== undefined) {
          stock = variant.stock;
        }
      }
    }

    // 3. Resolve Platform Variant (Phase 4 Ext)
    if (selectedPlatform && productData.variants) {
      // Find variant that matches Platform (and Storage if selected)
      const variant = productData.variants.find((v) => {
        const platformMatch =
          (v.platform || v.attributes?.platform) === selectedPlatform;
        const storageMatch =
          selectedStorage !== null && productData.storage
            ? v.storage === productData.storage[selectedStorage]
            : true;
        return platformMatch && storageMatch;
      });

      if (variant) {
        if (variant.price_override) {
          price = variant.price_override;
        } else if (variant.price_modifier) {
          price += variant.price_modifier;
        }
        if (variant.stock !== undefined) stock = variant.stock;
      }
    }

    return {
      price: `₦${price.toLocaleString()}`,
      rawPrice: price,
      stock,
      id: productData.id,
    };
  }, [selectedCondition, selectedStorage, selectedPlatform, productData]);

  const getProductForCart = () => {
    // Return object with numeric price for cart (cart expects price: number)
    return {
      id: productData.id,
      name: productData.name,
      price: currentOffer.rawPrice, // Cart expects numeric price
      rawPrice: currentOffer.rawPrice,
      image: productData.images[selectedImage],
      description: productData.description,
      rating: productData.rating,
      category: productData.categories?.name || (productData as any).category,
      condition: selectedCondition as 'New' | 'Used', // Use selected condition
      brand: productData.brand,
      // Pass platform if selected
      ...(selectedPlatform ? { platform: selectedPlatform } : {}),
    };
  };

  const validateAndAddToCart = () => {
    const missing = [];
    if (selectedColor === null && productData.colors.length > 0)
      missing.push('Color');
    if (selectedStorage === null && productData.storage.length > 0)
      missing.push('Storage');

    if (missing.length > 0) {
      setMissingFields(missing);
      setIsSelectionModalOpen(true);
      return;
    }

    const productToAdd = getProductForCart();

    addToCart(productToAdd as any, 1, {
      color:
        selectedColor !== null
          ? productData.colors[selectedColor].name
          : undefined,
      colorValue:
        selectedColor !== null
          ? productData.colors[selectedColor].value
          : undefined,
      secondaryColor:
        secondaryColor !== null
          ? productData.colors[secondaryColor].name
          : undefined,
      secondaryColorValue:
        secondaryColor !== null
          ? productData.colors[secondaryColor].value
          : undefined,
      storage:
        selectedStorage !== null
          ? productData.storage[selectedStorage]
          : undefined,
      condition: selectedCondition, // Pass condition to cart
    });

    toast({
      title: 'Added to cart',
      description: `${productData.name} has been added to your cart.`,
      className: 'bg-white text-gray-900 border-red-600 border-2',
    });
  };

  const handleDecrement = () => {
    if (currentCartItemId && quantityInCart > 0) {
      if (quantityInCart <= 1) {
        removeFromCart(currentCartItemId);
      } else {
        updateQuantity(currentCartItemId, quantityInCart - 1);
      }
    }
  };

  const handleIncrement = () => {
    if (currentCartItemId) {
      updateQuantity(currentCartItemId, quantityInCart + 1);
    }
  };

  const getDeliveryEstimate = () => {
    const today = new Date();
    const minDays = deliveryLocation === 'Lagos' ? 1 : 3;
    const maxDays = deliveryLocation === 'Lagos' ? 2 : 5;

    const formatDate = (daysToAdd: number) => {
      const date = new Date(today);
      date.setDate(today.getDate() + daysToAdd);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    };

    return `${formatDate(minDays)} - ${formatDate(maxDays)}`;
  };

  const handleToggleSaved = () => {
    const productForSaved: Product = {
      id: productData.id,
      name: productData.name,
      price: productData.price,
      rawPrice: productData.rawPrice,
      image: productData.image,
      description: productData.description,
      rating: productData.rating,
      category: productData.categories?.name || (productData as any).category,
      condition: productData.condition as 'New' | 'Used',
      brand: productData.brand,
      // Store additional details for full object persistence if needed
      // colors: productData.colors.map((c) => c.name),
      // storage: productData.storage[0],
    };
    toggleSaved(productForSaved as any);
  };

  const handleAddToCompare = (product: Product) => {
    addToCompare(product as any);
  };

  return (
    <div className="bg-white pb-32 pt-4 relative">
      {/* SEO handled by App Router generateMetadata() - see [category]/[productSlug]/page.tsx */}

      {/* Header Ad - Replaced with Banner Carousel */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-8">
        <BannerCarousel className="h-40 md:h-52" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link href={asRoute(basePath || '')} className="md:hover:text-red-600 transition-colors">
            Home
          </Link>
          <ChevronRight size={16} className="mx-2" />
          <Link
            href={`/${params.slug}/${productData.categories?.slug || productData.categorySlug || encodeURIComponent((productData.categories?.name || (productData as any).category || '').toLowerCase())}` as any}
            className="md:hover:text-red-600 transition-colors"
          >
            {productData.categories?.name || (productData as any).category}
          </Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="text-gray-900 font-medium">{productData.name}</span>
        </nav>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Left: Image Gallery (5 Cols) */}

          <div className="lg:col-span-5 space-y-6">
            <div className="relative aspect-square bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
              <Image
                src={productData.images[selectedImage]}
                alt={productData.name}
                fill
                className="object-cover transition-all duration-500"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
              />
              <div
                className={`absolute top-4 left-4 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${productData.condition?.toLowerCase() === 'new'
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
                  }`}
              >
                {selectedCondition}
              </div>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
              {productData.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedImage(idx);
                  }}
                  className={`relative w-24 h-24 bg-gray-50 rounded-xl border-2 flex-shrink-0 flex items-center justify-center p-0 overflow-hidden transition-all active:scale-95 ${selectedImage === idx ? 'border-red-600 ring-2 ring-red-100' : 'border-transparent md:hover:border-gray-200'}`}
                >
                  <Image
                    src={img}
                    alt={`View ${idx}`}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Middle: Product Info (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider">
                {productData.brand}
              </h2>
              <div className="flex gap-3">
                <button
                  className="text-gray-400 md:hover:text-red-600 transition-colors active:text-red-600"
                  aria-label="Share this product"
                >
                  <Share2 size={20} />
                </button>
                <button
                  onClick={handleToggleSaved}
                  className={`transition-colors active:text-red-600 ${isLiked ? 'text-red-600' : 'text-gray-400 md:hover:text-red-600'}`}
                  aria-label={isLiked ? "Remove from wishlist" : "Add to wishlist"}
                >
                  <Heart size={20} fill={isLiked ? 'currentColor' : 'none'} />
                </button>
              </div>
            </div>

            <h1 className="text-3xl md:text-3xl font-extrabold text-gray-900 mb-4">
              {productData.name}
            </h1>

            <div className="flex items-center gap-4 mb-6">
              <div
                className="flex items-center text-yellow-400 gap-0.5"
                role="img"
                aria-label={`Rated ${productData.rating} out of 5 stars`}
              >
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={18}
                    fill={
                      i < Math.floor(productData.rating)
                        ? 'currentColor'
                        : 'none'
                    }
                    className={
                      i >= Math.floor(productData.rating) ? 'text-gray-300' : ''
                    }
                    aria-hidden="true"
                  />
                ))}
              </div>
              <span className="text-sm text-gray-500 font-medium">
                {productData.reviewCount} Reviews
              </span>
            </div>

            <div className="text-3xl font-bold text-red-600 mb-6">
              {currentOffer.price}
            </div>

            {/* Condition Selector (Phase 7) */}
            {(productData.has_condition_offers || (productData.offers && productData.offers.length > 0)) && (
              <div className="mb-6">
                <label className="text-sm font-bold text-gray-900 block mb-3">
                  Condition: <span className="text-red-600">
                    {selectedCondition === 'used' ? 'Premium Used'
                      : selectedCondition === 'open_box' ? 'Open Box'
                        : selectedCondition.charAt(0).toUpperCase() + selectedCondition.slice(1)}
                  </span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {/* Render Main Product Option */}
                  <button
                    onClick={() => setSelectedCondition((productData.condition?.toLowerCase() || 'new') as ConditionType)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${selectedCondition === (productData.condition?.toLowerCase() || 'new')
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    {productData.condition === 'used' ? 'Premium Used'
                      : productData.condition === 'open_box' ? 'Open Box'
                        : productData.condition === 'new' ? 'New'
                          : productData.condition?.charAt(0).toUpperCase() + productData.condition?.slice(1) || 'New'}
                  </button>

                  {/* Render Other Offers */}
                  {productData.offers?.map((offer) => {
                    // Display friendly labels while keeping schema-compatible values
                    const displayLabel = offer.condition === 'used' ? 'Premium Used'
                      : offer.condition === 'open_box' ? 'Open Box'
                        : offer.condition.charAt(0).toUpperCase() + offer.condition.slice(1);

                    return (
                      <button
                        key={offer.id}
                        onClick={() => setSelectedCondition(offer.condition)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${selectedCondition === offer.condition
                          ? 'border-red-600 bg-red-50 text-red-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                      >
                        {displayLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Platform Selector (Phase 4 Extension) */}
            {Array.isArray(productData.platforms) && productData.platforms.length > 0 && (
              <div className="mb-6">
                <label className="text-sm font-bold text-gray-900 block mb-3">
                  Platform: <span className="text-red-600">{selectedPlatform || 'Select'}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {productData.platforms.map((platform: string) => (
                    <button
                      key={platform}
                      onClick={() => setSelectedPlatform(platform === selectedPlatform ? null : platform)}
                      className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${selectedPlatform === platform
                        ? 'border-red-600 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Estimated Delivery Section */}
            <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start justify-between">
              <div className="flex gap-3">
                <div className="mt-1 text-gray-400">
                  <MapPin size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-0.5">
                    Deliver to:{' '}
                    <span className="font-bold text-gray-900">
                      {deliveryLocation}
                    </span>
                  </p>
                  <p className="text-sm font-bold text-green-600">
                    Est. Delivery: {getDeliveryEstimate()}
                  </p>
                  {selectedStorage === null &&
                    productData.storage.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        Select storage to confirm availability
                      </p>
                    )}
                </div>
              </div>
              <button
                onClick={() =>
                  setDeliveryLocation((prev) =>
                    prev === 'Lagos' ? 'Outside Lagos' : 'Lagos'
                  )
                }
                className="text-xs font-bold text-red-600 hover:underline mt-1 active:scale-95 transition-transform"
                aria-label="Change delivery location"
              >
                Change
              </button>
            </div>

            {/* Color Selector */}
            {productData.colors.length > 0 && (
              <div className="mb-8 relative">
                {/* Color Selection Toast */}
                {showColorToast &&
                  selectedColor !== null &&
                  secondaryColor === null && (
                    <div className="absolute -top-12 left-0 right-0 z-20 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                      <div className="bg-gray-900 text-white text-xs py-2 px-3 rounded-lg shadow-lg flex items-center gap-2 max-w-fit">
                        <Info size={14} className="text-blue-400 shrink-0" />
                        <span>
                          Optional: Select a backup color in case your first
                          choice is out of stock.
                        </span>
                      </div>
                      <div className="w-2 h-2 bg-gray-900 rotate-45 ml-6 -mt-1" />
                    </div>
                  )}

                <label className="text-sm font-bold text-gray-900 block mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    Color:
                    <span className="text-red-600">
                      {selectedColor !== null
                        ? productData.colors[selectedColor].name
                        : 'Select a color'}
                    </span>
                    {secondaryColor !== null && (
                      <span className="text-gray-400 text-xs font-normal">
                        (+ {productData.colors[secondaryColor].name})
                      </span>
                    )}
                  </span>
                  {selectedColor === null && (
                    <span className="text-xs text-red-500 animate-pulse font-normal">
                      * Required
                    </span>
                  )}
                </label>

                <div className="flex flex-wrap gap-4">
                  {productData.colors.map((color, idx) => {
                    const isPrimary = selectedColor === idx;
                    const isSecondary = secondaryColor === idx;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleColorSelection(idx)}
                        onDoubleClick={() => handleColorDoubleClick(idx)}
                        className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 outline-none active:scale-95 ${isPrimary
                          ? 'border-[3px] border-red-600 scale-110 shadow-lg'
                          : isSecondary
                            ? 'border-[3px] border-blue-500 scale-105 shadow-md'
                            : 'border border-gray-200 md:hover:border-gray-400 md:hover:scale-105 shadow-sm'
                          }`}
                        aria-label={`Select color ${color.name}`}
                        title={color.name}
                      >
                        {/* Color Circle */}
                        <div
                          className="w-11 h-11 rounded-full border border-black/5 shadow-inner"
                          style={{ backgroundColor: color.value }}
                        />

                        {/* Primary Badge (1) */}
                        {isPrimary && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10">
                            1
                          </div>
                        )}

                        {/* Secondary Badge (2) */}
                        {isSecondary && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm z-10">
                            2
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Short description excerpt - skip SEO H2 sections, show benefits */}
            <p className="text-gray-600 leading-relaxed mb-8 border-b border-gray-100 pb-8 text-sm">
              {(() => {
                const desc = productData.description || '';

                // Try to extract content from "Why [Product] is Worth" section (benefits)
                // or skip the first H2 section which is SEO-focused price info
                const worthMatch = desc.match(
                  /<h2[^>]*>Why[^<]*Worth[^<]*<\/h2>\s*<p>([^<]+)/i
                );
                if (worthMatch?.[1]) {
                  const benefitText = worthMatch[1].trim();
                  return benefitText.length > 200
                    ? `${benefitText.substring(0, 200)}...`
                    : benefitText;
                }

                // Fallback: Skip first H2+paragraph (price section), get second paragraph
                const secondParagraph = desc.match(/<\/p>\s*<p>([^<]+)/);
                if (secondParagraph?.[1]) {
                  const text = secondParagraph[1].trim();
                  return text.length > 200
                    ? `${text.substring(0, 200)}...`
                    : text;
                }

                // Final fallback: strip all HTML but skip content before second sentence
                const plainText = desc
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim();
                const sentences = plainText.split(/(?<=[.!?])\s+/);
                // Skip first 2 sentences (usually the price Q&A), take next ones
                const excerpt = sentences.slice(2, 5).join(' ');
                return excerpt.length > 200
                  ? `${excerpt.substring(0, 200)}...`
                  : excerpt || `${plainText.substring(0, 200)}...`;
              })()}
            </p>

            {/* Storage Selector */}
            {productData.storage.length > 0 && (
              <div className="space-y-6 mb-8">
                <div>
                  <label className="text-sm font-bold text-gray-900 block mb-3 flex items-center justify-between">
                    <span>
                      Storage:{' '}
                      <span className="text-red-600">
                        {selectedStorage !== null
                          ? productData.storage[selectedStorage]
                          : 'Select storage'}
                      </span>
                    </span>
                    {selectedStorage === null && (
                      <span className="text-xs text-red-500 animate-pulse font-normal">
                        * Required
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {productData.storage.map((size, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedStorage(idx)}
                        className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${selectedStorage === idx ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-gray-200 text-gray-700 md:hover:border-gray-400 md:hover:bg-gray-50'}`}
                        aria-label={`Select ${size} storage`}
                        aria-pressed={selectedStorage === idx}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Desktop Actions (Hidden on Mobile) */}
            <div className="mb-8 hidden md:block">
              {quantityInCart > 0 ? (
                /* Quantity Controls + View Cart */
                <div className="flex gap-3">
                  <div className="flex items-center justify-between flex-1 h-14 bg-white border-2 border-red-600 rounded-xl overflow-hidden animate-in fade-in duration-200">
                    <button
                      onClick={handleDecrement}
                      className="h-full w-14 flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors border-r border-red-100"
                      aria-label="Decrease quantity"
                    >
                      {quantityInCart === 1 ? (
                        <Trash2 size={20} />
                      ) : (
                        <Minus size={20} />
                      )}
                    </button>
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                        In Cart
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={inputValue}
                        onChange={handleQuantityChange}
                        onBlur={handleQuantityBlur}
                        onKeyDown={handleKeyDown}
                        className="text-lg font-bold text-gray-900 w-12 text-center bg-transparent border-none outline-none p-0 focus:ring-0 focus:border-none focus:outline-none focus-visible:ring-0 focus-visible:outline-none active:ring-0"
                        aria-label="Quantity"
                      />
                    </div>
                    <button
                      onClick={handleIncrement}
                      className="h-full w-14 flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors border-l border-red-100"
                      aria-label="Increase quantity"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <Link
                    href={`/${params?.slug}/cart`}
                    className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-200 flex items-center justify-center gap-2"
                  >
                    <ShoppingCart size={20} />
                    View Cart
                  </Link>
                </div>
              ) : (
                /* Add to Cart Button */
                <button
                  onClick={validateAndAddToCart}
                  className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-200 flex items-center justify-center gap-2"
                >
                  Add to Cart
                </button>
              )}
            </div>

            {/* Perks Info - 4 cards in 2x2 grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <Truck size={16} className="text-red-600 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-gray-900">
                    Nationwide Delivery
                  </span>
                  <span className="text-gray-500">All states covered</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <RotateCcw size={16} className="text-red-600 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-gray-900">
                    14 Day Returns
                  </span>
                  <span className="text-gray-500">Easy return policy</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <ShieldCheck size={16} className="text-red-600 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-gray-900">
                    1 Year Warranty
                  </span>
                  <span className="text-gray-500">Official coverage</span>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                <ShieldPlus size={16} className="text-red-600 flex-shrink-0" />
                <div className="text-xs">
                  <span className="font-bold block text-gray-900">
                    Device Protection
                  </span>
                  <span className="text-gray-500">Coverage available</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Ad Sidebar - UPDATED with Half Page */}
          <div className="lg:col-span-3 lg:border-l lg:border-gray-100 lg:pl-8 hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Sponsored
              </p>
              {/* Replaced with high-value vertical unit */}
              <AdUnit placementKey="SIDEBAR_HALF_PAGE" className="mb-6" />
            </div>
          </div>
        </div>

        {/* Content Break Ad */}
        <div className="mt-12 mb-12">
          <AdUnit placementKey="CONTENT_BREAK" />
        </div>

        {/* Tabs Section */}
        <div className="mt-8">
          <div className="flex border-b border-gray-200 mb-8 overflow-x-auto hide-scrollbar" role="tablist">
            <button
              onClick={() => setActiveTab('description')}
              className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'description' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              role="tab"
              aria-selected={activeTab === 'description'}
              aria-controls="tab-description"
              id="tab-btn-description"
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab('specs')}
              className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'specs' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              role="tab"
              aria-selected={activeTab === 'specs'}
              aria-controls="tab-specs"
              id="tab-btn-specs"
            >
              Specifications
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'reviews' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              role="tab"
              aria-selected={activeTab === 'reviews'}
              aria-controls="tab-reviews"
              id="tab-btn-reviews"
            >
              Reviews (124)
            </button>
            <button
              onClick={() => setActiveTab('compare')}
              className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'compare' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              role="tab"
              aria-selected={activeTab === 'compare'}
              aria-controls="tab-compare"
              id="tab-btn-compare"
            >
              <ArrowRightLeft size={18} /> Compare
            </button>
          </div>

          <div className="min-h-[300px]">
            {activeTab === 'description' && (
              <div className="prose max-w-none text-gray-600 animate-in fade-in duration-300">
                {/* Render description as HTML with client-side sanitization */}
                <div
                  className="mb-4 prose-headings:text-gray-900 prose-strong:text-gray-800 prose-table:text-sm"
                  // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml, typescript.react.react-dangerouslysetinnerhtml-prop.react-dangerouslysetinnerhtml-prop
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(productData.description || '') }}
                />

                {/* Dynamic Product Highlights for SEO & Readability */}
                <div className="mt-6 mb-6">
                  <h2 className="font-bold text-gray-900 mb-3 text-lg">Key Highlights</h2>
                  <ul className="list-disc pl-5 space-y-2 text-gray-600">
                    {/* Priority 1: Use explicit highlights/features if available */}
                    {productData.specs && productData.specs.length > 0 ? (
                      productData.specs.slice(0, 5).map((spec: any, i: number) => (
                        <li key={i}>
                          <span className="font-medium text-gray-900">{spec.label}:</span> {spec.value}
                        </li>
                      ))
                    ) : (
                      /* Priority 2: Auto-generate from available fields */
                      <>
                        {productData.displaySize && <li>{productData.displaySize} Display</li>}
                        {productData.ram && <li>{productData.ram} RAM</li>}
                        {productData.storage && productData.storage.length > 0 && (
                          <li>{productData.storage[0]} Storage</li>
                        )}
                        {productData.condition && <li>Condition: {productData.condition as any}</li>}
                        <li>{productData.brand} Official Warranty</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'specs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                {productData.detailedSpecs?.map((section: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-2xl p-6 border border-gray-100"
                  >
                    <h3 className="text-lg font-bold text-gray-900 mb-4">
                      {section.category}
                    </h3>
                    <ul className="space-y-3">
                      {section.items.map((item: any, i: number) => (
                        <li
                          key={i}
                          className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4 border-b border-gray-200 last:border-0 pb-2 last:pb-0"
                        >
                          <span className="text-sm font-medium text-gray-500 w-32 shrink-0">
                            {item.label}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 text-left sm:text-right">
                            {item.value}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    Customer Reviews
                  </h3>
                  <button className="text-sm font-bold text-red-600 hover:text-red-700">
                    Write a Review
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-gray-50 p-6 rounded-2xl text-center border border-gray-100">
                    <div className="text-5xl font-extrabold text-gray-900 mb-2">
                      {productData.rating}
                    </div>
                    <div className="flex justify-center gap-1 text-yellow-400 mb-2">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={20} fill="currentColor" />
                      ))}
                    </div>
                    <p className="text-sm text-gray-500">
                      Based on {productData.reviewCount} reviews
                    </p>
                  </div>

                  {/* Rating Bars */}
                  <div className="col-span-2 space-y-2">
                    {[5, 4, 3, 2, 1].map((num) => (
                      <div key={num} className="flex items-center gap-4">
                        <span className="text-xs font-bold text-gray-500 w-3">
                          {num}
                        </span>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{
                              width:
                                num === 5 ? '80%' : num === 4 ? '15%' : '2%',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {productData.reviewCount === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <User size={32} className="mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No reviews yet. Be the first to review this product!</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Reviews are loaded from the store&apos;s review system.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'compare' && (
              <ProductComparisonTable mainProduct={productData} storeSlug={params?.slug as string} />
            )}
          </div >
        </div >

        {productData.videoUrl && (
          <ProductVideo videoId={productData.videoUrl} title={productData.name} />
        )}

        <BlogSnippet
          category={productData.categories?.name || (productData as any).category}
          productId={String(productData.id)}
          merchantId={merchantContext?.merchant?.id}
        />

        {/* Koray-aligned semantic sections */}
        <div className="max-w-[1400px] mx-auto">
          {/* Same brand, same category - builds brand entity */}
          <BrandProducts
            product={serverProduct as any}
            maxProducts={4}
            className="border-t border-gray-100 pt-8"
          />

          {/* Same category, similar price - supports comparison intent */}
          <PriceRangeProducts
            product={serverProduct as any}
            maxProducts={4}
            className="border-t border-gray-100"
          />
        </div>
      </div >

      {/* --- FIXED MOBILE BOTTOM BAR (positioned above bottom nav) --- */}
      <div className="fixed bottom-20 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40 md:hidden shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        {quantityInCart > 0 ? (
          /* Quantity Controls + View Cart */
          <div className="flex gap-3">
            <div className="flex items-center justify-between bg-white border-2 border-red-600 rounded-xl h-14 flex-1">
              <button
                onClick={handleDecrement}
                className="h-full w-14 flex items-center justify-center text-red-600 active:bg-red-50 rounded-l-xl border-r border-red-100"
              >
                {quantityInCart === 1 ? (
                  <Trash2 size={20} />
                ) : (
                  <Minus size={20} />
                )}
              </button>
              <div className="flex-1 flex flex-col items-center justify-center">
                <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">In Cart</span>
                <span className="font-bold text-gray-900 text-lg">{quantityInCart}</span>
              </div>
              <button
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  triggerFlyToCart(rect);
                  handleIncrement();
                }}
                className="h-full w-14 flex items-center justify-center text-red-600 active:bg-red-50 rounded-r-xl border-l border-red-100"
              >
                <Plus size={20} />
              </button>
            </div>
            <Link
              href={`/${params?.slug}/cart`}
              className="flex-1 h-14 bg-red-600 active:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:shadow-none active:scale-[0.98] transition-all"
            >
              <ShoppingCart size={20} />
              View Cart
            </Link>
          </div>
        ) : (
          /* Add to Cart Button - Full Width */
          <button
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const missing = [];
              if (selectedColor === null && productData.colors.length > 0) missing.push('Color');
              if (selectedStorage === null && productData.storage.length > 0) missing.push('Storage');

              if (missing.length === 0) {
                triggerFlyToCart(rect);
              }
              validateAndAddToCart();
            }}
            className="w-full h-14 bg-red-600 active:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:shadow-none active:scale-[0.98] transition-all"
          >
            <ShoppingCart size={20} />
            Add to Cart
          </button>
        )}
      </div>

      {/* Animation Portal */}
      {
        animatingParticles.map((rect, i) => (
          <FlyToCartAnimation
            key={i}
            startRect={rect}
            onComplete={handleAnimationComplete}
            imageSrc={productData.images[0]}
          />
        ))
      }

      {/* --- SELECTION REQUIRED MODAL --- */}
      {
        isSelectionModalOpen && (
          <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center px-0 md:px-4">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsSelectionModalOpen(false)}
            />
            <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-10 duration-300">
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <h3
                  className={`font-bold text-lg flex items-center gap-2 ${missingFields.length === 0 ? 'text-green-600' : 'text-gray-900'}`}
                >
                  {missingFields.length === 0 ? (
                    <>
                      <Check size={20} /> All Set
                    </>
                  ) : (
                    <>
                      <AlertCircle className="text-red-600" size={20} />
                      Select Options
                    </>
                  )}
                </h3>
                <button
                  onClick={() => setIsSelectionModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                  aria-label="Close"
                >
                  <X size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <p className="text-sm text-gray-500">
                  {missingFields.length === 0
                    ? "Perfect! You're ready to go."
                    : 'Please select the following options to proceed:'}
                </p>

                {/* Color Selection in Modal */}
                {(missingFields.includes('Color') ||
                  missingFields.length === 0) && (
                    <div>
                      <label className="text-sm font-bold text-gray-900 block mb-3">
                        Color
                      </label>
                      <div className="flex flex-wrap gap-4">
                        {productData.colors?.map((color, idx) => {
                          const isSelected = selectedColor === idx;
                          const isLight = [
                            '#f2f2f2',
                            '#ffffff',
                            '#Bfb7ad',
                          ].includes(color.value);

                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                setSelectedColor(idx);
                                setSelectedImage(idx);
                                setMissingFields((prev) =>
                                  prev.filter((f) => f !== 'Color')
                                );
                              }}
                              className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 outline-none focus:ring-4 focus:ring-red-100 active:scale-95 ${isSelected
                                ? 'border-[3px] border-red-600 scale-110 shadow-lg'
                                : 'border border-gray-200 md:hover:border-gray-400 md:hover:scale-105 shadow-sm'
                                }`}
                            >
                              <div
                                className="w-11 h-11 rounded-full border border-black/5 shadow-inner"
                                style={{ backgroundColor: color.value }}
                              />
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                  <Check
                                    size={20}
                                    className={
                                      isLight ? 'text-gray-900' : 'text-white'
                                    }
                                    strokeWidth={3}
                                  />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                {/* Storage Selection in Modal */}
                {(missingFields.includes('Storage') ||
                  missingFields.length === 0) && (
                    <div>
                      <label className="text-sm font-bold text-gray-900 block mb-3">
                        Storage
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {productData.storage?.map((size, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedStorage(idx);
                              setMissingFields((prev) =>
                                prev.filter((f) => f !== 'Storage')
                              );
                            }}
                            className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${selectedStorage === idx ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 md:rounded-b-2xl">
                <button
                  onClick={() => {
                    if (missingFields.length === 0) {
                      setIsSelectionModalOpen(false);
                      validateAndAddToCart();
                    }
                  }}
                  disabled={missingFields.length > 0}
                  className="w-full bg-red-600 disabled:bg-gray-300 disabled:text-gray-500 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg disabled:shadow-none active:scale-[0.98]"
                >
                  {missingFields.length > 0
                    ? `Select ${missingFields.length} more option${missingFields.length > 1 ? 's' : ''}`
                    : 'Add to Cart Now'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Negotiation Modal */}
      <NegotiationModal
        isOpen={isNegotiationOpen}
        onClose={() => setIsNegotiationOpen(false)}
        productName={productData.name}
        currentPrice={productData.rawPrice || 0}
        onSuccess={(price) => {
          setIsNegotiationOpen(false);
          // If options are selected (or not required), add to cart with negotiated price
          if (
            (selectedColor !== null ||
              !productData.colors ||
              productData.colors?.length === 0) &&
            (selectedStorage !== null ||
              !productData.storage ||
              productData.storage?.length === 0)
          ) {
            const productToAdd = getProductForCart();

            addToCart(productToAdd as any, 1, {
              color:
                selectedColor !== null
                  ? productData.colors[selectedColor].name
                  : undefined,
              colorValue:
                selectedColor !== null
                  ? productData.colors[selectedColor].value
                  : undefined,
              secondaryColor:
                secondaryColor !== null
                  ? productData.colors[secondaryColor].name
                  : undefined,
              secondaryColorValue:
                secondaryColor !== null
                  ? productData.colors[secondaryColor].value
                  : undefined,
              storage:
                selectedStorage !== null
                  ? productData.storage[selectedStorage]
                  : undefined,
            });

            const cartItemId = `${productData.id}-${selectedColor !== null ? productData.colors[selectedColor].name : ''}-${selectedStorage !== null ? productData.storage[selectedStorage] : ''}`;
            applyNegotiatedPrice?.(cartItemId, price);
          } else {
            // Need to select options first
            setIsSelectionModalOpen(true);
            // We lose the negotiated price context here slightly unless we store it.
            // For now, let's just open selection. The user might need to negotiate again or we could enhance state to store pending negotiated price.
            // Given the complexity, let's just proceed to selection.
          }
        }}
      />
    </div >
  );
};
