
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Truck, ShieldCheck, Share2, Heart, Minus, Plus, ChevronRight, ArrowRightLeft, Trash2, HandCoins, AlertCircle, X, ShoppingCart, Check, MapPin, User, Info, Search } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useSaved } from '../contexts/SavedContext';
import { useComparison } from '../contexts/ComparisonContext';
import { Product } from '../types';
import { products } from '../data/products';
import { AdUnit } from './AdUnit';
import { BlogSnippet } from './BlogSnippet';
import { NegotiationModal } from './NegotiationModal';
import { BannerCarousel } from './BannerCarousel';
import { SEO } from './SEO';

// Fallback Mock data if product is not found
const FALLBACK_PRODUCT = {
  id: 1,
  name: 'iPhone 15 Pro Max',
  brand: 'Apple',
  price: '₦1,950,000',
  rawPrice: 1950000,
  rating: 4.8,
  reviewCount: 124,
  description: 'iPhone 15 Pro Max. Forged in titanium and featuring the groundbreaking A17 Pro chip, a customizable Action button, and the most powerful iPhone camera system ever.',
  image: 'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop',
  images: [
    'https://images.unsplash.com/photo-1696446701796-da61225697cc?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1697316986292-6927d3c0157f?q=80&w=1000&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1695048133021-3e0f47e3079c?q=80&w=1000&auto=format&fit=crop'
  ],
  colors: [
    { name: 'Natural Titanium', value: '#Bfb7ad' },
    { name: 'Blue Titanium', value: '#2f3d4d' },
    { name: 'White Titanium', value: '#f2f2f2' },
    { name: 'Black Titanium', value: '#1a1a1a' }
  ],
  storage: ['256GB', '512GB', '1TB'],
  ram: '8GB',
  simType: 'Dual eSIM',
  displayType: 'OLED',
  displaySize: '6.7"',
  specs: [
    { label: 'Screen Size', value: '6.7 inches' },
    { label: 'Processor', value: 'A17 Pro chip' },
    { label: 'Main Camera', value: '48MP Main' },
    { label: 'Battery', value: 'Up to 29 hours video playback' },
    { label: 'OS', value: 'iOS 17' }
  ],
  detailedSpecs: [
    {
      category: "Network",
      items: [
        { label: "Technology", value: "GSM / CDMA / HSPA / EVDO / LTE / 5G" },
        { label: "Speed", value: "HSPA, LTE-A, 5G, EV-DO Rev.A 3.1 Mbps" }
      ]
    }
  ],
  category: 'Phones',
  condition: 'New'
};

// Mock Reviews
const MOCK_REVIEWS = [
  {
    id: 1,
    user: "Ahmed Musa",
    rating: 5,
    date: "2 days ago",
    comment: "Best phone I've ever used. The titanium feel is premium and much lighter than my 14 Pro Max. Battery life is solid.",
    verified: true
  },
  {
    id: 2,
    user: "Sarah Okon",
    rating: 4,
    date: "1 week ago",
    comment: "Camera is amazing, especially the 5x zoom. Only issue is it gets a bit warm during heavy gaming.",
    verified: true
  },
  {
    id: 3,
    user: "David Cohen",
    rating: 5,
    date: "2 weeks ago",
    comment: "Delivery to Abuja was super fast (2 days). Product is authentic. Highly recommend Ogabassey.",
    verified: true
  }
];

export const ProductDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, cartItems, updateQuantity, removeFromCart, applyNegotiatedPrice } = useCart();
  const { toggleSaved, isSaved } = useSaved();
  const { compareItems, addToCompare, removeFromCompare, isInCompare } = useComparison();
  
  // Find product from data
  const productFound = products.find(p => String(p.id) === id);

  const getColorHex = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('black') || lower.includes('obsidian') || lower.includes('midnight') || lower.includes('graphite') || lower.includes('space grey')) return '#1a1a1a';
      if (lower.includes('white') || lower.includes('starlight') || lower.includes('porcelain')) return '#f2f2f2';
      if (lower.includes('blue') || lower.includes('bay') || lower.includes('pacific')) return '#2f3d4d';
      if (lower.includes('natural') || lower.includes('grey') || lower.includes('gray')) return '#808080';
      if (lower.includes('silver')) return '#e0e0e0';
      if (lower.includes('gold')) return '#F5E0C3';
      return '#cccccc';
  };

  const productData = useMemo(() => {
      const base = productFound ? { ...FALLBACK_PRODUCT, ...productFound } : FALLBACK_PRODUCT;
      
      // Normalize Colors
      let normalizedColors = FALLBACK_PRODUCT.colors;
      if (productFound?.colors && productFound.colors.length > 0) {
          normalizedColors = productFound.colors.map(c => ({
              name: c,
              value: getColorHex(c)
          }));
      }

      // Normalize Storage
      let normalizedStorage = FALLBACK_PRODUCT.storage;
      if (productFound?.storage) {
          normalizedStorage = [productFound.storage];
      } else if (!productFound) {
          normalizedStorage = FALLBACK_PRODUCT.storage;
      } else {
          normalizedStorage = productFound.category === 'Phones' || productFound.category === 'Laptops' 
            ? normalizedStorage 
            : [];
      }

      // Normalize Images
      let normalizedImages = FALLBACK_PRODUCT.images;
      if (productFound?.image) {
          normalizedImages = [productFound.image, ...FALLBACK_PRODUCT.images.slice(1)];
      }

      return {
          ...base,
          image: productFound?.image || FALLBACK_PRODUCT.image,
          images: normalizedImages,
          colors: normalizedColors,
          storage: normalizedStorage
      };
  }, [productFound]);

  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [secondaryColor, setSecondaryColor] = useState<number | null>(null); 
  const [selectedStorage, setSelectedStorage] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'reviews' | 'compare'>('description');
  const [deliveryLocation, setDeliveryLocation] = useState<'Lagos' | 'Outside Lagos'>('Lagos');
  const [showColorToast, setShowColorToast] = useState(false);
  
  // Negotiation Logic
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);
  
  // Selection Logic
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  // Comparison Logic - Compute comparable items
  const comparableProducts = useMemo(() => {
      // 1. Get items from context that match category AND are NOT the current product
      const contextItems = compareItems.filter(p => p.category === productData.category && String(p.id) !== String(productData.id));
      
      // 2. If we don't have enough comparison items (let's say we want at least 2 competitors), fill with random products
      let finalItems = [...contextItems];
      if (finalItems.length < 2) {
          const suggestions = products
            .filter(p => p.category === productData.category && String(p.id) !== String(productData.id) && !finalItems.some(fi => String(fi.id) === String(p.id)))
            .sort(() => 0.5 - Math.random())
            .slice(0, 2 - finalItems.length);
          finalItems = [...finalItems, ...suggestions];
      }
      return finalItems.slice(0, 3); // Max 3 competitors
  }, [compareItems, productData.category, productData.id]);

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const isLiked = isSaved(productData.id);

  // Derived state to find if this exact variant is in cart
  const currentCartItemId = (selectedColor !== null && selectedStorage !== null)
    ? `${productData.id}-${productData.colors[selectedColor].name}-${productData.storage[selectedStorage]}`
    : null;
    
  const cartItem = currentCartItemId ? cartItems.find(item => item.cartItemId === currentCartItemId) : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const handleColorSelection = (idx: number) => {
    if (selectedColor === idx) {
        if (secondaryColor !== null) {
            setSelectedColor(secondaryColor);
            setSecondaryColor(null);
            setSelectedImage(secondaryColor); 
        } else {
            setSelectedColor(null);
        }
        return;
    }
    if (secondaryColor === idx) {
        setSecondaryColor(null);
        return;
    }
    if (selectedColor === null) {
        setSelectedColor(idx);
        setSelectedImage(idx);
        setShowColorToast(true);
        setTimeout(() => setShowColorToast(false), 5000);
        return;
    }
    if (secondaryColor === null) {
        setSecondaryColor(idx);
        setShowColorToast(false);
        return;
    }
    setSecondaryColor(idx);
  };

  const getProductForCart = (): Product => {
      return {
        id: productData.id,
        name: productData.name,
        price: productData.price,
        rawPrice: productData.rawPrice,
        image: productData.images[selectedImage],
        description: productData.description,
        rating: productData.rating,
        category: productData.category,
        condition: productData.condition as 'New' | 'Used',
        brand: productData.brand,
      };
  };

  const validateAndAddToCart = () => {
    const missing = [];
    if (selectedColor === null && productData.colors.length > 0) missing.push('Color');
    if (selectedStorage === null && productData.storage.length > 0) missing.push('Storage');

    if (missing.length > 0) {
      setMissingFields(missing);
      setIsSelectionModalOpen(true);
      return;
    }

    const productToAdd = getProductForCart();

    addToCart(productToAdd, 1, {
      color: selectedColor !== null ? productData.colors[selectedColor].name : undefined,
      colorValue: selectedColor !== null ? productData.colors[selectedColor].value : undefined,
      secondaryColor: secondaryColor !== null ? productData.colors[secondaryColor].name : undefined,
      secondaryColorValue: secondaryColor !== null ? productData.colors[secondaryColor].value : undefined,
      storage: selectedStorage !== null ? productData.storage[selectedStorage] : undefined
    });
  };

  const handleDecrement = () => {
    if (currentCartItemId && quantityInCart > 0) {
        if (quantityInCart <= 1) {
            removeFromCart(currentCartItemId);
        } else {
            updateQuantity(currentCartItemId, -1);
        }
    }
  };

  const handleIncrement = () => {
      if (currentCartItemId) {
          updateQuantity(currentCartItemId, 1);
      }
  };

  const getDeliveryEstimate = () => {
    const today = new Date();
    const minDays = deliveryLocation === 'Lagos' ? 1 : 3;
    const maxDays = deliveryLocation === 'Lagos' ? 2 : 5;

    const formatDate = (daysToAdd: number) => {
        const date = new Date(today);
        date.setDate(today.getDate() + daysToAdd);
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
          category: productData.category,
          condition: productData.condition as 'New' | 'Used',
          brand: productData.brand,
          colors: productData.colors.map(c => c.name),
          storage: productData.storage[0]
      };
      toggleSaved(productForSaved);
  };

  const handleAddToCompare = (product: Product) => {
      addToCompare(product);
  };

  return (
    <div className="bg-white pb-32 pt-4 relative">
      <SEO 
        title={productData.name}
        description={productData.description}
        image={productData.images[0]}
        type="product"
        price={productData.rawPrice}
        currency="NGN"
        availability={productData.condition === 'New' ? 'InStock' : 'PreOrder'}
        brand={productData.brand}
        rating={productData.rating}
        reviewCount={productData.reviewCount}
      />
      
      {/* Header Ad - Replaced with Banner Carousel */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 mb-8">
         <BannerCarousel className="h-40 md:h-52" />
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* Breadcrumb */}
        <nav className="flex items-center text-sm text-gray-500 mb-8 overflow-x-auto whitespace-nowrap pb-2">
          <Link to="/" className="md:hover:text-red-600 transition-colors">Home</Link>
          <ChevronRight size={16} className="mx-2" />
          <Link to={`/category/${productData.category}`} className="md:hover:text-red-600 transition-colors">{productData.category}</Link>
          <ChevronRight size={16} className="mx-2" />
          <span className="text-gray-900 font-medium">{productData.name}</span>
        </nav>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          
          {/* Left: Image Gallery (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="relative aspect-square bg-gray-50 rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100">
               <img 
                  src={productData.images[selectedImage]} 
                  alt={productData.name}
                  className="w-full h-full object-cover transition-all duration-500"
               />
               <div className={`absolute top-4 left-4 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  productData.condition === 'New' ? 'bg-emerald-500' : 'bg-amber-500'
                }`}>
                 {productData.condition}
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
                  <img src={img} alt={`View ${idx}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Middle: Product Info (4 Cols) */}
          <div className="lg:col-span-4 flex flex-col">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider">{productData.brand}</h2>
              <div className="flex gap-3">
                 <button className="text-gray-400 md:hover:text-red-600 transition-colors active:text-red-600">
                   <Share2 size={20} />
                 </button>
                 <button 
                    onClick={handleToggleSaved}
                    className={`transition-colors active:text-red-600 ${isLiked ? 'text-red-600' : 'text-gray-400 md:hover:text-red-600'}`}
                 >
                   <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                 </button>
              </div>
            </div>

            <h1 className="text-3xl md:text-3xl font-extrabold text-gray-900 mb-4">{productData.name}</h1>

            <div className="flex items-center gap-4 mb-6">
               <div className="flex items-center text-yellow-400 gap-0.5">
                 {[...Array(5)].map((_, i) => (
                    <Star key={i} size={18} fill={i < Math.floor(productData.rating) ? "currentColor" : "none"} className={i >= Math.floor(productData.rating) ? "text-gray-300" : ""} />
                 ))}
               </div>
               <span className="text-sm text-gray-500 font-medium">{productData.reviewCount} Reviews</span>
            </div>

            <div className="text-3xl font-bold text-red-600 mb-6">{productData.price}</div>

            {/* Estimated Delivery Section */}
            <div className="mb-6 p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-start justify-between">
                <div className="flex gap-3">
                     <div className="mt-1 text-gray-400"><MapPin size={20} /></div>
                     <div>
                         <p className="text-xs text-gray-500 mb-0.5">Deliver to: <span className="font-bold text-gray-900">{deliveryLocation}</span></p>
                         <p className="text-sm font-bold text-green-600">
                             Est. Delivery: {getDeliveryEstimate()}
                         </p>
                         {selectedStorage === null && productData.storage.length > 0 && <p className="text-[10px] text-gray-400 mt-1">Select storage to confirm availability</p>}
                     </div>
                </div>
                <button
                    onClick={() => setDeliveryLocation(prev => prev === 'Lagos' ? 'Outside Lagos' : 'Lagos')}
                    className="text-xs font-bold text-red-600 hover:underline mt-1 active:scale-95 transition-transform"
                >
                    Change
                </button>
            </div>

            {/* Color Selector */}
            {productData.colors.length > 0 && (
            <div className="mb-8 relative">
               {/* Color Selection Toast */}
               {showColorToast && selectedColor !== null && secondaryColor === null && (
                   <div className="absolute -top-12 left-0 right-0 z-20 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-none">
                       <div className="bg-gray-900 text-white text-xs py-2 px-3 rounded-lg shadow-lg flex items-center gap-2 max-w-fit">
                           <Info size={14} className="text-blue-400 shrink-0" />
                           <span>Optional: Select a backup color in case your first choice is out of stock.</span>
                       </div>
                       <div className="w-2 h-2 bg-gray-900 rotate-45 ml-6 -mt-1"></div>
                   </div>
               )}

               <label className="text-sm font-bold text-gray-900 block mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                      Color: 
                      <span className="text-red-600">
                          {selectedColor !== null ? productData.colors[selectedColor].name : 'Select a color'}
                      </span>
                      {secondaryColor !== null && (
                          <span className="text-gray-400 text-xs font-normal">
                              (+ {productData.colors[secondaryColor].name})
                          </span>
                      )}
                  </span>
                  {selectedColor === null && <span className="text-xs text-red-500 animate-pulse font-normal">* Required</span>}
               </label>
               
               <div className="flex flex-wrap gap-4">
                  {productData.colors.map((color, idx) => {
                     const isPrimary = selectedColor === idx;
                     const isSecondary = secondaryColor === idx;
                     
                     return (
                     <button
                       key={idx}
                       onClick={() => handleColorSelection(idx)}
                       className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 outline-none active:scale-95 ${
                           isPrimary 
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
                        ></div>
                        
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
                  )})}
               </div>
            </div>
            )}

            <p className="text-gray-600 leading-relaxed mb-8 border-b border-gray-100 pb-8 text-sm">
              {productData.description}
            </p>

            {/* Storage Selector */}
            {productData.storage.length > 0 && (
            <div className="space-y-6 mb-8">
               <div>
                  <label className="text-sm font-bold text-gray-900 block mb-3 flex items-center justify-between">
                    <span>Storage: <span className="text-red-600">{selectedStorage !== null ? productData.storage[selectedStorage] : 'Select storage'}</span></span>
                    {selectedStorage === null && <span className="text-xs text-red-500 animate-pulse font-normal">* Required</span>}
                  </label>
                  <div className="flex flex-wrap gap-3">
                     {productData.storage.map((size, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedStorage(idx)}
                          className={`px-4 py-3 rounded-xl border text-sm font-bold transition-all active:scale-95 ${selectedStorage === idx ? 'border-red-600 bg-red-50 text-red-700 ring-2 ring-red-100' : 'border-gray-200 text-gray-700 md:hover:border-gray-400 md:hover:bg-gray-50'}`}
                        >
                          {size}
                        </button>
                     ))}
                  </div>
               </div>
            </div>
            )}

            {/* Desktop Actions (Hidden on Mobile) */}
            <div className="mb-8 h-14 hidden md:block">
               {quantityInCart > 0 ? (
                  /* Counter State */
                  <div className="flex items-center justify-between w-full h-full bg-white border-2 border-red-600 rounded-xl overflow-hidden animate-in fade-in duration-200">
                      <button 
                        onClick={handleDecrement}
                        className="h-full w-16 flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors border-r border-red-100"
                      >
                         {quantityInCart === 1 ? <Trash2 size={20} /> : <Minus size={20} />}
                      </button>
                      <div className="flex-1 flex flex-col items-center justify-center">
                         <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Quantity</span>
                         <span className="text-lg font-bold text-gray-900">{quantityInCart}</span>
                      </div>
                      <button 
                        onClick={handleIncrement}
                        className="h-full w-16 flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors border-l border-red-100"
                      >
                         <Plus size={20} />
                      </button>
                  </div>
               ) : (
                  /* Add to Cart Button */
                  <button 
                    onClick={validateAndAddToCart}
                    className="w-full h-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-red-200 flex items-center justify-center gap-2"
                  >
                     Add to Cart
                  </button>
               )}
            </div>
            
            {/* Delivery Info */}
            <div className="space-y-3">
               <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <Truck size={18} className="text-red-600" />
                  <div className="text-xs">
                     <span className="font-bold block text-gray-900">Free Delivery</span>
                     <span className="text-gray-500">Orders over ₦500k</span>
                  </div>
               </div>
               <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <ShieldCheck size={18} className="text-red-600" />
                  <div className="text-xs">
                     <span className="font-bold block text-gray-900">Warranty</span>
                     <span className="text-gray-500">1 year included</span>
                  </div>
               </div>
            </div>
          </div>

          {/* Right: Ad Sidebar - UPDATED with Half Page */}
          <div className="lg:col-span-3 lg:border-l lg:border-gray-100 lg:pl-8 hidden lg:block">
            <div className="sticky top-24">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Sponsored</p>
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
           <div className="flex border-b border-gray-200 mb-8 overflow-x-auto hide-scrollbar">
              <button 
                onClick={() => setActiveTab('description')}
                className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'description' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              >
                Description
              </button>
              <button 
                onClick={() => setActiveTab('specs')}
                className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'specs' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              >
                Specifications
              </button>
              <button 
                onClick={() => setActiveTab('reviews')}
                className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap ${activeTab === 'reviews' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              >
                Reviews (124)
              </button>
               <button 
                onClick={() => setActiveTab('compare')}
                className={`pb-4 px-6 font-semibold text-lg transition-colors whitespace-nowrap flex items-center gap-2 ${activeTab === 'compare' ? 'text-red-600 border-b-2 border-red-600' : 'text-gray-500 md:hover:text-gray-800'}`}
              >
                <ArrowRightLeft size={18} /> Compare
              </button>
           </div>

           <div className="min-h-[300px]">
              {activeTab === 'description' && (
                <div className="prose max-w-none text-gray-600 animate-in fade-in duration-300">
                  <p className="mb-4">{productData.description}</p>
                  <ul className="list-disc pl-5 space-y-2 mt-4">
                    <li>Titanium design</li>
                    <li>A17 Pro chip</li>
                    <li>Action button</li>
                    <li>48MP Main camera</li>
                    <li>USB-C connector</li>
                  </ul>
                </div>
              )}
              
              {activeTab === 'specs' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                   {productData.detailedSpecs?.map((section, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                         <h3 className="text-lg font-bold text-gray-900 mb-4">{section.category}</h3>
                         <ul className="space-y-3">
                            {section.items.map((item, i) => (
                               <li key={i} className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1 sm:gap-4 border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                                  <span className="text-sm font-medium text-gray-500 w-32 shrink-0">{item.label}</span>
                                  <span className="text-sm font-semibold text-gray-900 text-left sm:text-right">{item.value}</span>
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
                      <h3 className="text-xl font-bold text-gray-900">Customer Reviews</h3>
                      <button className="text-sm font-bold text-red-600 hover:text-red-700">Write a Review</button>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                       <div className="bg-gray-50 p-6 rounded-2xl text-center border border-gray-100">
                          <div className="text-5xl font-extrabold text-gray-900 mb-2">{productData.rating}</div>
                          <div className="flex justify-center gap-1 text-yellow-400 mb-2">
                             {[...Array(5)].map((_, i) => <Star key={i} size={20} fill="currentColor" />)}
                          </div>
                          <p className="text-sm text-gray-500">Based on {productData.reviewCount} reviews</p>
                       </div>
                       
                       {/* Rating Bars */}
                       <div className="col-span-2 space-y-2">
                          {[5,4,3,2,1].map(num => (
                             <div key={num} className="flex items-center gap-4">
                                <span className="text-xs font-bold text-gray-500 w-3">{num}</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                   <div className="h-full bg-yellow-400 rounded-full" style={{ width: num === 5 ? '80%' : num === 4 ? '15%' : '2%' }}></div>
                                </div>
                             </div>
                          ))}
                       </div>
                   </div>

                   <div className="space-y-4">
                      {MOCK_REVIEWS.map((review) => (
                         <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold text-xs">
                                     <User size={14} />
                                  </div>
                                  <div>
                                     <h4 className="font-bold text-gray-900 text-sm">{review.user}</h4>
                                     <span className="text-xs text-gray-400">{review.date}</span>
                                  </div>
                               </div>
                               <div className="flex text-yellow-400">
                                  {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < review.rating ? "currentColor" : "none"} className={i >= review.rating ? "text-gray-200" : ""} />)}
                               </div>
                            </div>
                            <p className="text-gray-600 text-sm mb-3">{review.comment}</p>
                            {review.verified && (
                               <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                  <Check size={12} /> Verified Purchase
                               </div>
                            )}
                         </div>
                      ))}
                   </div>
                </div>
              )}

              {activeTab === 'compare' && (
                 <div className="animate-in fade-in duration-300">
                    <div className="overflow-x-auto pb-4 hide-scrollbar">
                       <div className="min-w-[800px] grid grid-cols-4 gap-4">
                          {/* Labels Column */}
                          <div className="space-y-4 pt-44 border-r border-gray-100 pr-2">
                             {[
                                 { label: 'Price', key: 'price' },
                                 { label: 'Rating', key: 'rating' },
                                 { label: 'Brand', key: 'brand' },
                                 { label: 'Condition', key: 'condition' },
                                 { label: 'Storage', key: 'storage' },
                                 { label: 'RAM', key: 'ram' },
                                 { label: 'Screen', key: 'displaySize' },
                                 { label: 'Display Type', key: 'displayType' },
                                 { label: 'SIM', key: 'simType' }
                             ].map((field, i) => (
                                <div key={i} className={`h-12 flex items-center px-4 text-sm font-bold text-gray-500 ${i % 2 !== 0 ? 'bg-gray-50 rounded-lg' : ''}`}>
                                   {field.label}
                                </div>
                             ))}
                          </div>

                          {/* Main Product Column */}
                          <div className="space-y-4 relative bg-red-50/20 -mx-2 px-2 rounded-2xl border border-red-100/50 pb-4">
                             <div className="absolute top-2 right-2 text-[10px] bg-red-600 text-white px-2 py-0.5 rounded-full font-bold shadow-sm z-10">Current</div>
                             <div className="h-44 flex flex-col items-center justify-end pb-4 pt-4">
                                <div className="bg-white p-2 rounded-xl shadow-sm mb-2 overflow-hidden border border-red-100 h-24 w-24 flex items-center justify-center">
                                  <img src={productData.images[0]} alt={productData.name} className="h-full w-full object-contain" />
                                </div>
                                <span className="font-bold text-gray-900 text-center text-sm line-clamp-2 px-2 h-10 flex items-center">{productData.name}</span>
                             </div>
                             
                             <div className="h-12 flex items-center justify-center font-bold text-red-600 text-lg">{productData.price}</div>
                             <div className="h-12 flex items-center justify-center bg-white/50 rounded-lg text-sm font-medium">{productData.rating}/5 <Star size={12} className="ml-1 fill-yellow-400 text-yellow-400" /></div>
                             <div className="h-12 flex items-center justify-center text-sm font-bold text-gray-800">{productData.brand}</div>
                             <div className="h-12 flex items-center justify-center bg-white/50 rounded-lg text-xs font-bold uppercase text-green-600">{productData.condition}</div>
                             <div className="h-12 flex items-center justify-center text-sm">{productData.storage ? productData.storage[0] : '-'}</div>
                             <div className="h-12 flex items-center justify-center bg-white/50 rounded-lg text-sm">{productData.ram || '-'}</div>
                             <div className="h-12 flex items-center justify-center text-sm">{productData.displaySize || '-'}</div>
                             <div className="h-12 flex items-center justify-center bg-white/50 rounded-lg text-xs text-center px-1">{productData.displayType || '-'}</div>
                             <div className="h-12 flex items-center justify-center text-xs text-center px-1">{productData.simType || '-'}</div>
                          </div>

                          {/* Dynamic Competitors */}
                          {comparableProducts.map((comp, idx) => (
                             <div key={idx} className="space-y-4 relative group">
                                <div className="h-44 flex flex-col items-center justify-end pb-4 pt-4 opacity-90 hover:opacity-100 transition-opacity">
                                   <div className="p-2 mb-2 rounded-xl overflow-hidden bg-gray-50 border border-gray-200 h-24 w-24 flex items-center justify-center">
                                      <img src={comp.image} alt={comp.name} className="h-full w-full object-contain mix-blend-multiply" />
                                   </div>
                                   <Link to={`/product/${comp.id}`} className="font-bold text-gray-500 text-center text-sm line-clamp-2 px-2 hover:text-red-600 transition-colors h-10 flex items-center">{comp.name}</Link>
                                </div>

                                <div className="h-12 flex items-center justify-center font-bold text-gray-700">{comp.price}</div>
                                <div className="h-12 flex items-center justify-center bg-gray-50 rounded-lg text-sm text-gray-600">{comp.rating}/5</div>
                                <div className="h-12 flex items-center justify-center text-sm text-gray-600 font-medium">{comp.brand}</div>
                                <div className="h-12 flex items-center justify-center bg-gray-50 rounded-lg text-xs font-bold uppercase text-gray-500">{comp.condition}</div>
                                <div className="h-12 flex items-center justify-center text-sm text-gray-600">{comp.storage || '-'}</div>
                                <div className="h-12 flex items-center justify-center bg-gray-50 rounded-lg text-sm text-gray-600">{comp.ram || '-'}</div>
                                <div className="h-12 flex items-center justify-center text-sm text-gray-600">{comp.displaySize || '-'}</div>
                                <div className="h-12 flex items-center justify-center bg-gray-50 rounded-lg text-xs text-gray-600 text-center px-1">{comp.displayType || '-'}</div>
                                <div className="h-12 flex items-center justify-center text-xs text-gray-600 text-center px-1">{comp.simType || '-'}</div>

                                {/* Comparison Actions */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                                    {isInCompare(comp.id) ? (
                                        <button 
                                            onClick={() => removeFromCompare(comp.id)}
                                            className="bg-white text-red-500 p-1 rounded-full shadow-sm border border-gray-200 hover:bg-red-50"
                                            title="Remove from comparison"
                                        >
                                            <X size={14} />
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleAddToCompare(comp)}
                                            className="bg-white text-blue-500 p-1 rounded-full shadow-sm border border-gray-200 hover:bg-blue-50"
                                            title="Add to comparison list"
                                        >
                                            <Plus size={14} />
                                        </button>
                                    )}
                                </div>
                                <div className="flex justify-center mt-4">
                                    <button 
                                        onClick={() => addToCart(comp, 1)}
                                        className="text-xs font-bold text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition-colors"
                                    >
                                        Add to Cart
                                    </button>
                                </div>
                             </div>
                          ))}
                          
                          {/* Add More Placeholder if slots empty */}
                          {comparableProducts.length < 2 && (
                              <div className="h-full flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/30">
                                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                      <Search size={20} />
                                  </div>
                                  <p className="text-xs text-gray-400 font-medium text-center px-4">Browse products to add to comparison</p>
                                  <Link to={`/category/${productData.category}`} className="text-xs font-bold text-red-600 hover:underline">
                                      Browse {productData.category}
                                  </Link>
                              </div>
                          )}
                       </div>
                    </div>
                 </div>
              )}
           </div>
        </div>
        
        <BlogSnippet category={productData.category} />
      </div>

      {/* --- FIXED MOBILE BOTTOM BAR --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 z-50 md:hidden flex gap-3 shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
        <button 
          onClick={() => setIsNegotiationOpen(true)}
          className="flex-1 bg-gray-100 active:bg-gray-200 md:hover:bg-gray-200 text-gray-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all border border-gray-200 active:scale-[0.98]"
        >
          <HandCoins size={20} className="text-red-600" />
          Negotiate
        </button>
        {quantityInCart > 0 ? (
           <button 
             onClick={() => navigate('/cart')}
             className="flex-1 bg-green-600 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
           >
             View Cart ({quantityInCart})
           </button>
        ) : (
           <button 
             onClick={validateAndAddToCart}
             className="flex-1 bg-red-600 active:bg-red-700 md:hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:shadow-none active:scale-[0.98]"
           >
             <ShoppingCart size={20} />
             Add to Cart
           </button>
        )}
      </div>

      {/* --- SELECTION REQUIRED MODAL --- */}
      {isSelectionModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center px-0 md:px-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsSelectionModalOpen(false)}></div>
          <div className="bg-white w-full md:max-w-md md:rounded-2xl rounded-t-2xl shadow-2xl relative z-10 animate-in slide-in-from-bottom-10 duration-300">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
               <h3 className={`font-bold text-lg flex items-center gap-2 ${missingFields.length === 0 ? 'text-green-600' : 'text-gray-900'}`}>
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
               <button onClick={() => setIsSelectionModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                 <X size={20} className="text-gray-500" />
               </button>
            </div>
            
            <div className="p-6 space-y-6">
               <p className="text-sm text-gray-500">
                  {missingFields.length === 0 ? "Perfect! You're ready to go." : "Please select the following options to proceed:"}
               </p>
               
               {/* Color Selection in Modal */}
               {(missingFields.includes('Color') || missingFields.length === 0) && (
                 <div>
                    <label className="text-sm font-bold text-gray-900 block mb-3">Color</label>
                    <div className="flex flex-wrap gap-4">
                        {productData.colors.map((color, idx) => {
                          const isSelected = selectedColor === idx;
                          const isLight = ['#f2f2f2', '#ffffff', '#Bfb7ad'].includes(color.value);
                          
                          return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedColor(idx);
                              setSelectedImage(idx);
                              setMissingFields(prev => prev.filter(f => f !== 'Color'));
                            }}
                            className={`group relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 outline-none focus:ring-4 focus:ring-red-100 active:scale-95 ${
                                isSelected 
                                ? 'border-[3px] border-red-600 scale-110 shadow-lg' 
                                : 'border border-gray-200 md:hover:border-gray-400 md:hover:scale-105 shadow-sm'
                            }`}
                          >
                              <div className="w-11 h-11 rounded-full border border-black/5 shadow-inner" style={{ backgroundColor: color.value }}></div>
                              {isSelected && (
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <Check size={20} className={isLight ? "text-gray-900" : "text-white"} strokeWidth={3} />
                                </div>
                              )}
                          </button>
                        )})}
                    </div>
                 </div>
               )}

               {/* Storage Selection in Modal */}
               {(missingFields.includes('Storage') || missingFields.length === 0) && (
                 <div>
                    <label className="text-sm font-bold text-gray-900 block mb-3">Storage</label>
                    <div className="flex flex-wrap gap-3">
                        {productData.storage.map((size, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedStorage(idx);
                              setMissingFields(prev => prev.filter(f => f !== 'Storage'));
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
                 {missingFields.length > 0 ? `Select ${missingFields.length} more option${missingFields.length > 1 ? 's' : ''}` : 'Add to Cart Now'}
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
        currentPrice={productData.rawPrice}
        onSuccess={(price) => {
           setIsNegotiationOpen(false);
           if ((selectedColor !== null || productData.colors.length === 0) && (selectedStorage !== null || productData.storage.length === 0)) {
               const productToAdd = getProductForCart();
               
               addToCart(productToAdd, 1, {
                  color: selectedColor !== null ? productData.colors[selectedColor].name : undefined,
                  colorValue: selectedColor !== null ? productData.colors[selectedColor].value : undefined,
                  secondaryColor: secondaryColor !== null ? productData.colors[secondaryColor].name : undefined,
                  secondaryColorValue: secondaryColor !== null ? productData.colors[secondaryColor].value : undefined,
                  storage: selectedStorage !== null ? productData.storage[selectedStorage] : undefined
               });
               
               const cartItemId = `${productData.id}-${selectedColor !== null ? productData.colors[selectedColor].name : ''}-${selectedStorage !== null ? productData.storage[selectedStorage] : ''}`;
               applyNegotiatedPrice(cartItemId, price);
           } else {
              setIsSelectionModalOpen(true);
           }
        }}
      />
    </div>
  );
};
