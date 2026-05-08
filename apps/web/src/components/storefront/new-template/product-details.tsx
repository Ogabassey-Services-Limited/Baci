'use client';

import {
  AlertCircle,
  Check,
  ChevronRight,
  HandCoins,
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  X,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCart } from '@/hooks/use-cart';
import { products } from './data';
import { Footer } from './footer';
import { Navbar } from './navbar';
import { NegotiationModal } from './negotiation-modal';
import { useSaved } from './saved-context'; // We created a stub for this

export const ProductDetails: React.FC = () => {
  const params = useParams();
  const _router = useRouter();
  const { addToCart, cart } = useCart();
  const { savedItems, toggleSaved } = useSaved();

  const productSlug = params?.productSlug as string;
  // In a real app, we'd fetch by slug. For now, find by ID or mock it.
  // The mock data uses IDs like '1', '2'. Let's assume slug is ID for now or find by some logic.
  const productData = products.find((p) => p.id === productSlug) || products[0];

  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [_secondaryColor, _setSecondaryColor] = useState<number | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!productData) {
    return <div>Product not found</div>;
  }

  const isSaved = savedItems.includes(productData.id);

  // Calculate quantity in cart for this product
  // Note: This is a simplification. Real cart might have multiple items for same product with different variants.
  const _quantityInCart = cart
    .filter((item: any) => item.id === productData.id)
    .reduce((acc: number, item: any) => acc + item.quantity, 0);

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const validateAndAddToCart = () => {
    const missing = [];
    if (
      productData.colors &&
      productData.colors.length > 0 &&
      selectedColor === null
    )
      missing.push('Color');
    if (
      productData.storage &&
      productData.storage.length > 0 &&
      selectedStorage === null
    )
      missing.push('Storage');

    if (missing.length > 0) {
      setMissingFields(missing);
      setIsSelectionModalOpen(true);
      return;
    }

    const _productToAdd = getProductForCart();

    addToCart(
      {
        ...productData,
        // Cast to any to avoid strict type check for now as Product types might mismatch
        image: productData.images
          ? productData.images[selectedImage]
          : productData.image,
      } as any,
      quantity,
      {
        variantId: `${productData.id}-${selectedColor !== null && productData.colors ? productData.colors[selectedColor].name : 'default'}-${selectedStorage !== null && productData.storage ? productData.storage[selectedStorage] : 'default'}`,
        variantAttributes: {
          color:
            selectedColor !== null && productData.colors
              ? productData.colors[selectedColor].name
              : '',
          storage:
            selectedStorage !== null && productData.storage
              ? productData.storage[selectedStorage]
              : '',
        },
      }
    );

    // Reset selection or give feedback
    // toast.success("Added to cart!");
  };

  const getProductForCart = () => {
    // Map to CartItem structure
    return {
      id: productData.id,
      name: productData.name,
      price: productData.price,
      image: productData.images
        ? productData.images[selectedImage]
        : productData.image,
      // ... other fields
    };
  };

  const applyNegotiatedPrice = (cartItemId: string, price: number) => {
    // TODO: In a real implementation, we would update the cart item price here.
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      {/* Breadcrumbs */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link href="/" className="hover:text-red-600 transition-colors">
            Home
          </Link>
          <ChevronRight size={14} />
          <Link
            href={'/category/phones' as any}
            className="hover:text-red-600 transition-colors"
          >
            Phones
          </Link>
          <ChevronRight size={14} />
          <span className="text-gray-900 font-medium truncate">
            {productData.name}
          </span>
        </div>
      </div>

      <main className="max-w-[1400px] mx-auto px-4 md:px-6 pb-20">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-12">
            {/* Left Column: Images */}
            <div className="p-6 md:p-10 bg-white">
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-6 group">
                <Image
                  src={
                    productData.images
                      ? productData.images[selectedImage]
                      : productData.image
                  }
                  alt={productData.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-contain mix-blend-multiply p-8 transition-transform duration-500 group-hover:scale-105"
                />

                {/* Image Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {productData.discount && (
                    <span className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-red-600/20">
                      -{productData.discount}% OFF
                    </span>
                  )}
                  {productData.isNew && (
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-blue-600/20">
                      NEW ARRIVAL
                    </span>
                  )}
                </div>

                <button
                  onClick={() => toggleSaved(productData.id)}
                  className="absolute top-4 right-4 p-3 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all active:scale-90 z-10"
                  aria-label={isSaved ? "Remove from saved" : "Save product"}
                >
                  <Heart
                    size={20}
                    className={
                      isSaved ? 'fill-red-500 text-red-500' : 'text-gray-400'
                    }
                  />
                </button>
              </div>

              {/* Thumbnails */}
              {productData.images && productData.images.length > 1 && (
                <div className="grid grid-cols-5 gap-3">
                  {productData.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedImage(idx)}
                      className={`relative aspect-square rounded-xl border-2 p-2 bg-gray-50 transition-all ${selectedImage === idx ? 'border-red-600 ring-2 ring-red-100' : 'border-transparent hover:border-gray-200'}`}
                      aria-label={`View image ${idx + 1}`}
                    >
                      <Image
                        src={img}
                        alt=""
                        fill
                        sizes="20vw"
                        className="object-contain mix-blend-multiply"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Product Info */}
            <div className="p-6 md:p-10 lg:pl-0 flex flex-col">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-bold uppercase tracking-wider">
                    {productData.brand}
                  </span>
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star size={14} fill="currentColor" />
                    <span className="text-sm font-bold text-gray-900">
                      {productData.rating}
                    </span>
                    <span className="text-xs text-gray-400 font-medium">
                      ({productData.reviews} reviews)
                    </span>
                  </div>
                </div>

                <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                  {productData.name}
                </h1>

                <div className="flex items-end gap-4 mb-6">
                  <div className="flex flex-col">
                    <span className="text-3xl md:text-4xl font-bold text-red-600 tracking-tight">
                      ₦{productData.price.toLocaleString()}
                    </span>
                    {productData.originalPrice && (
                      <span className="text-sm text-gray-400 line-through font-medium">
                        ₦{productData.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  {productData.discount && (
                    <div className="mb-2 px-2 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-lg">
                      Save ₦
                      {(
                        (typeof productData.originalPrice === 'number'
                          ? productData.originalPrice
                          : 0) -
                        (productData.rawPrice ??
                          (typeof productData.price === 'number'
                            ? productData.price
                            : 0))
                      ).toLocaleString()}
                    </div>
                  )}
                </div>

                <p className="text-gray-600 leading-relaxed mb-8">
                  {productData.description}
                </p>

                {/* Configuration Options */}
                <div className="space-y-6 mb-8">
                  {/* Color Selection */}
                  {productData.colors && productData.colors.length > 0 && (
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm font-bold text-gray-900">
                          Select Color
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                          {selectedColor !== null
                            ? productData.colors[selectedColor].name
                            : 'Required'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {productData.colors.map((color, idx) => {
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
                                setSelectedImage(idx); // Sync image with color
                                setMissingFields((prev) =>
                                  prev.filter((f) => f !== 'Color')
                                );
                              }}
                              className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 outline-hidden focus:ring-4 focus:ring-red-100 ${
                                isSelected
                                  ? 'border-[3px] border-red-600 scale-110 shadow-lg'
                                  : 'border border-gray-200 hover:border-gray-400 hover:scale-105'
                              }`}
                              title={color.name}
                              aria-label={`Select color ${color.name}`}
                            >
                              <div
                                className="w-9 h-9 rounded-full border border-black/5 shadow-inner"
                                style={{ backgroundColor: color.value }}
                              />
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                  <Check
                                    size={18}
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

                  {/* Storage Selection */}
                  {productData.storage && productData.storage.length > 0 && (
                    <div>
                      <div className="flex justify-between mb-3">
                        <span className="text-sm font-bold text-gray-900">
                          Storage
                        </span>
                        <span className="text-sm text-gray-500 font-medium">
                          {selectedStorage !== null
                            ? productData.storage[selectedStorage]
                            : 'Required'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {productData.storage.map((size, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedStorage(idx);
                              setMissingFields((prev) =>
                                prev.filter((f) => f !== 'Storage')
                              );
                            }}
                            className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${selectedStorage === idx ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-100">
                  {/* Quantity */}
                  <div className="flex items-center bg-gray-100 rounded-xl p-1 w-fit">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-red-600 disabled:opacity-50"
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={16} />
                    </button>
                    <span className="w-12 text-center font-bold text-gray-900">
                      {quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-red-600"
                      aria-label="Increase quantity"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {/* Add to Cart & Negotiate */}
                  <div className="flex-1 flex gap-3">
                    <button
                      onClick={() => setIsNegotiationOpen(true)}
                      className="px-4 py-3.5 rounded-xl border-2 border-gray-200 text-gray-700 font-bold hover:border-gray-300 hover:bg-gray-50 transition-all flex flex-col items-center justify-center leading-none gap-1 min-w-[100px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <HandCoins size={18} className="text-red-600" />
                        <span>Negotiate</span>
                      </div>
                    </button>

                    <button
                      onClick={validateAndAddToCart}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
                    >
                      <ShoppingCart size={20} />
                      <span>Add to Cart</span>
                    </button>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-green-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        1 Year Warranty
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Official manufacturer warranty
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm text-blue-600">
                      <Truck size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">
                        Free Delivery
                      </p>
                      <p className="text-[10px] text-gray-500">
                        For orders over ₦500k
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* --- SELECTION REQUIRED MODAL --- */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 z-80 flex items-end md:items-center justify-center px-0 md:px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs"
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
                aria-label="Close modal"
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
                missingFields.length === 0) &&
                productData.colors && (
                  <div>
                    <label className="text-sm font-bold text-gray-900 block mb-3">
                      Color
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {productData.colors.map((color, idx) => {
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
                            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 outline-hidden focus:ring-4 focus:ring-red-100 active:scale-95 ${
                              isSelected
                                ? 'border-[3px] border-red-600 scale-110 shadow-lg'
                                : 'border border-gray-200 md:hover:border-gray-400 md:hover:scale-105 shadow-sm'
                            }`}
                            aria-label={`Select color ${color.name}`}
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
                missingFields.length === 0) &&
                productData.storage && (
                  <div>
                    <label className="text-sm font-bold text-gray-900 block mb-3">
                      Storage
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {productData.storage.map((size, idx) => (
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
      )}

      {/* Negotiation Modal */}
      <NegotiationModal
        isOpen={isNegotiationOpen}
        onClose={() => setIsNegotiationOpen(false)}
        productName={productData.name}
        currentPrice={
          productData.rawPrice ??
          (typeof productData.price === 'number' ? productData.price : 0)
        }
        onSuccess={(price) => {
          setIsNegotiationOpen(false);
          if (
            (selectedColor !== null || !productData.colors?.length) &&
            (selectedStorage !== null || !productData.storage?.length)
          ) {
            // Add to cart with negotiated price
            const _productToAdd = getProductForCart();
            // Note: This logic assumes addToCart supports price override or we handle it.
            // For now, we just add it.
            validateAndAddToCart();
            applyNegotiatedPrice(productData.id, price);
          } else {
            setIsSelectionModalOpen(true);
          }
        }}
      />
    </div>
  );
};
