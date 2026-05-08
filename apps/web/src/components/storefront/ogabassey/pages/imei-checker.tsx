'use client';

import {
  AlertTriangle,
  BadgeCheck,
  Check,
  ChevronRight,
  Globe,
  Loader2,
  Lock,
  ScanBarcode,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
} from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { useState, useEffect } from 'react';

// Service tiers matching the API
const SERVICE_TIERS = {
  basic: {
    id: 'basic',
    name: 'Quick ID',
    tagline: 'What phone is this?',
    price: 100,
    priceDisplay: '₦100',
    features: ['Device Model', 'Model Number'],
    icon: Smartphone,
    color: 'gray',
  },
  blacklist: {
    id: 'blacklist',
    name: 'Stolen Check',
    tagline: 'Is it reported stolen?',
    price: 300,
    priceDisplay: '₦300',
    features: ['Device Model', 'Blacklist Status', 'GSMA Database'],
    icon: ShieldAlert,
    color: 'orange',
  },
  carrier: {
    id: 'carrier',
    name: 'Network Check',
    tagline: 'Will my SIM work?',
    price: 500,
    priceDisplay: '₦500',
    features: ['Device Model', 'Original Carrier', 'SIM Lock Status'],
    icon: Globe,
    color: 'blue',
  },
  icloud: {
    id: 'icloud',
    name: 'iCloud Check',
    tagline: 'Is Find My on?',
    price: 800,
    priceDisplay: '₦800',
    features: ['Device Model', 'iCloud Lock', 'Activation Status'],
    icon: Lock,
    color: 'purple',
  },
  full: {
    id: 'full',
    name: 'Full Report',
    tagline: 'Know everything',
    price: 1500,
    priceDisplay: '₦1,500',
    features: [
      'Device Model',
      'iCloud Status',
      'Blacklist Check',
      'Carrier Info',
      'SIM Lock',
      'Trust Score',
    ],
    icon: BadgeCheck,
    color: 'green',
    recommended: true,
  },
} as const;

type ServiceTier = keyof typeof SERVICE_TIERS;

interface ImeiResult {
  imei: string;
  device: string;
  modelNumber: string;
  status: 'Clean' | 'Blacklisted' | 'Unknown';
  icloud: string;
  icloudLock: string;
  simLock: string;
  blacklistStatus: string;
  carrier: string;
  deviceImage: string;
  score: number;
  serialNumber?: string;
  purchaseDate?: string;
  purchaseCountry?: string;
  warranty?: string;
  refurbished?: string;
  demoUnit?: string;
  deviceType: 'apple' | 'android' | 'other';
  verdict: string;
  verdictType: 'safe' | 'caution' | 'danger';
}
// Product suggestion interface for autocomplete
interface ProductSuggestion {
  id: string;
  name: string;
  category?: string;
  image?: string;
}

export const OgabasseyImeiChecker: React.FC = () => {
  const [imei, setImei] = useState('');
  const [selectedTier, setSelectedTier] = useState<ServiceTier>('full');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImeiResult | null>(null);
  const [showTierPicker, setShowTierPicker] = useState(false);

  // Device search autocomplete state
  const [deviceQuery, setDeviceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<ProductSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Debounced search for product suggestions
  useEffect(() => {
    if (deviceQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/storefront/products?q=${encodeURIComponent(deviceQuery)}&limit=5`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(
            data.data?.map((p: Record<string, unknown>) => ({
              id: p.id as string,
              name: p.name as string,
              category: p.category as string | undefined,
              image: p.image as string | undefined,
            })) || []
          );
        }
      } catch {
        console.warn('Failed to fetch device suggestions');
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [deviceQuery]);

  const handleSelectDevice = (device: ProductSuggestion) => {
    setSelectedDevice(device);
    setDeviceQuery(device.name);
    setShowSuggestions(false);
  };

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imei.trim()) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/storefront/imei-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imei: imei.trim(), tier: selectedTier }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setError(data.error || 'Unable to check IMEI. Please try again.');
        return;
      }

      setResult(data.data);
    } catch (err) {
      console.error('IMEI check failed:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const _isIcloudClean = (status: string) => {
    const s = status.toLowerCase();
    return s === 'clean' || s === 'off' || s.includes('off');
  };

  const isBlacklistClean = (status: string) => {
    const s = status.toLowerCase();
    return s === 'clean' || s === 'not found' || s.includes('clean');
  };

  const currentTier = SERVICE_TIERS[selectedTier];

  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white pb-24 md:pb-12 pt-4 md:pt-8 flex flex-col">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 w-full flex-1">
        {/* Hero Section - More Compelling */}
        <div className="max-w-3xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-6">
            <ShieldCheck size={14} />
            Trusted by 10,000+ Buyers
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
            Don't Get Scammed.
            <br />
            <span className="text-red-600">Verify First.</span>
          </h1>

          <p className="text-gray-600 text-lg mb-4 max-w-xl mx-auto leading-relaxed">
            That "Brand New" iPhone might be{' '}
            <span className="font-semibold text-gray-900">
              stolen, iCloud locked, or refurbished
            </span>
            . One quick check can save you from losing ₦500,000+.
          </p>

          {/* Trust Indicators */}
          <div className="flex items-center justify-center gap-6 text-sm text-gray-500 mb-8">
            <div className="flex items-center gap-1.5">
              <Check size={16} className="text-green-600" />
              <span>Instant Results</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={16} className="text-green-600" />
              <span>Official Database</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check size={16} className="text-green-600" />
              <span>100% Accurate</span>
            </div>
          </div>
        </div>

        {/* Main Check Section */}
        {!result && (
          <>
            {/* Step 1: Device Search */}
            <div className="max-w-xl mx-auto mb-8">
              <p className="text-center text-sm font-medium text-gray-500 mb-3">
                Step 1: What device are you checking?
              </p>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Smartphone className="text-gray-400" size={20} />
                </div>
                <input
                  type="text"
                  value={deviceQuery}
                  onChange={(e) => {
                    setDeviceQuery(e.target.value);
                    setShowSuggestions(true);
                    if (!e.target.value) setSelectedDevice(null);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Type device name (e.g., iPhone 16, Samsung S24...)"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:ring-4 focus:ring-red-500/10 focus:border-red-200 outline-hidden text-base transition-all"
                />
                {searchLoading && (
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                    <Loader2 className="animate-spin text-gray-400" size={18} />
                  </div>
                )}

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                    {suggestions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectDevice(product)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-50 last:border-0"
                      >
                        {product.image && (
                          <Image
                            src={product.image}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          {product.category && (
                            <p className="text-xs text-gray-500">{product.category}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedDevice && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-green-600">
                  <Check size={16} />
                  <span>Checking: <strong>{selectedDevice.name}</strong></span>
                </div>
              )}
            </div>

            {/* Step 2: Service Tier Selection */}
            <div className="max-w-4xl mx-auto mb-8">
              <p className="text-center text-sm font-medium text-gray-500 mb-4">
                Step 2: Choose what you want to verify:
              </p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {(Object.keys(SERVICE_TIERS) as ServiceTier[]).map((tierKey) => {
                  const tier = SERVICE_TIERS[tierKey];
                  const isSelected = selectedTier === tierKey;
                  const Icon = tier.icon;

                  return (
                    <button
                      key={tierKey}
                      type="button"
                      onClick={() => setSelectedTier(tierKey)}
                      className={`relative p-4 rounded-2xl border-2 transition-all text-left ${isSelected
                        ? 'border-red-500 bg-red-50 shadow-lg shadow-red-100'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
                        }`}
                    >
                      {'recommended' in tier && tier.recommended && (
                        <div className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star size={10} fill="currentColor" />
                          BEST
                        </div>
                      )}
                      <Icon
                        size={24}
                        className={isSelected ? 'text-red-600' : 'text-gray-400'}
                      />
                      <p
                        className={`font-bold text-sm mt-2 ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}
                      >
                        {tier.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {tier.tagline}
                      </p>
                      <p
                        className={`text-sm font-bold mt-2 ${isSelected ? 'text-red-600' : 'text-gray-900'}`}
                      >
                        {tier.priceDisplay}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* What's included */}
              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setShowTierPicker(!showTierPicker)}
                  className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                >
                  What's included in {currentTier.name}?
                  <ChevronRight
                    size={14}
                    className={`transition-transform ${showTierPicker ? 'rotate-90' : ''}`}
                  />
                </button>
                {showTierPicker && (
                  <div className="mt-3 inline-flex flex-wrap justify-center gap-2">
                    {currentTier.features.map((feature) => (
                      <span
                        key={feature}
                        className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full"
                      >
                        <Check size={12} className="text-green-600" />
                        {feature}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* IMEI Input */}
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 p-3 md:p-4">
                <form
                  onSubmit={handleCheck}
                  className="flex flex-col md:flex-row gap-3"
                >
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <ScanBarcode className="text-gray-400" size={20} />
                    </div>
                    <input
                      type="text"
                      value={imei}
                      onChange={(e) =>
                        setImei(e.target.value.replace(/\D/g, '').slice(0, 15))
                      }
                      placeholder="Enter 15-digit IMEI Number"
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 hover:bg-white focus:bg-white border border-transparent focus:border-red-100 rounded-2xl focus:ring-4 focus:ring-red-500/10 outline-hidden text-lg font-mono tracking-widest transition-all placeholder:font-sans placeholder:tracking-normal text-gray-900"
                    />
                  </div>
                  <button
                    disabled={isLoading || imei.length < 15}
                    type="submit"
                    className="bg-red-600 text-white font-bold text-base px-8 py-4 rounded-2xl hover:bg-red-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-red-200 active:scale-95 whitespace-nowrap"
                  >
                    {isLoading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <>
                        Verify Now · {currentTier.priceDisplay}
                        <Sparkles size={18} />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-left">
                  <AlertTriangle className="text-red-500 shrink-0" size={20} />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* How to find IMEI */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-500 mb-3">
                  How to find your IMEI:
                </p>
                <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <span>
                      Dial <strong className="text-gray-900">*#06#</strong>
                    </span>
                  </div>
                  <div className="hidden md:block text-gray-300">→</div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <span>Copy the 15-digit number</span>
                  </div>
                  <div className="hidden md:block text-gray-300">→</div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-xs font-bold">
                      3
                    </span>
                    <span>Paste above & verify</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Why Verify - Social Proof */}
            <div className="max-w-4xl mx-auto mt-16">
              <h2 className="text-center text-xl font-bold text-gray-900 mb-8">
                Why Smart Buyers Always Verify
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4">
                    <ShieldAlert size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    1 in 5 Used Phones Are Stolen
                  </h3>
                  <p className="text-sm text-gray-500">
                    Don't become an accomplice. Stolen phones get blacklisted
                    and become worthless. Check before you pay.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4">
                    <Lock size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    iCloud Lock = Expensive Paperweight
                  </h3>
                  <p className="text-sm text-gray-500">
                    If Find My iPhone is ON, you can't use the phone. Period.
                    Sellers hide this. We expose it.
                  </p>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center mb-4">
                    <BadgeCheck size={24} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2">
                    "Brand New" Often Isn't
                  </h3>
                  <p className="text-sm text-gray-500">
                    Refurbished phones sold as new is rampant. Our check reveals
                    when the device was actually activated.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* RESULTS SECTION */}
        {result && (
          <div className="max-w-2xl mx-auto mb-16 animate-in slide-in-from-bottom-8 duration-700">
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
              {/* Header with Device Image */}
              <div
                className={`p-6 md:p-8 ${result.status === 'Clean' ? 'bg-green-50/50' : 'bg-red-50/50'}`}
              >
                <div className="flex flex-col md:flex-row items-center gap-6">
                  {/* Device Image */}
                  <div className="relative w-28 h-28 shrink-0 bg-white rounded-2xl p-2 shadow-sm border border-gray-100">
                    {result.deviceImage ? (
                      <Image
                        src={result.deviceImage}
                        alt={result.device}
                        fill sizes="112px"
                        className="object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Smartphone size={48} />
                      </div>
                    )}
                  </div>

                  {/* Device Info */}
                  <div className="flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                        {currentTier.name} Report
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-xs font-mono text-gray-500">
                        {new Date().toLocaleString()}
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                      {result.device}
                    </h2>
                    <p className="text-sm text-gray-500 font-mono mt-1">
                      IMEI: {result.imei}
                    </p>
                    {result.modelNumber && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Model: {result.modelNumber}
                      </p>
                    )}
                  </div>

                  {/* Trust Score */}
                  <div
                    className={`px-4 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[100px] ${result.status === 'Clean' ? 'bg-white border-green-100' : 'bg-white border-red-100'}`}
                  >
                    <span
                      className={`text-2xl font-black ${result.status === 'Clean' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {result.score}%
                    </span>
                    <span className="text-[10px] font-bold uppercase text-gray-400">
                      Trust Score
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Grid */}
              <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Blacklist Status */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isBlacklistClean(result.blacklistStatus) ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                  >
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                      Blacklist Status
                    </p>
                    <p
                      className={`font-bold text-base ${isBlacklistClean(result.blacklistStatus) ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {result.blacklistStatus}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      GSMA Database Check
                    </p>
                  </div>
                </div>

                {/* iCloud Lock (Find My iPhone) */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${result.icloudLock.toLowerCase() === 'off' || result.icloudLock.toLowerCase() === 'unknown' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}
                  >
                    <Lock size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                      Find My iPhone
                    </p>
                    <p
                      className={`font-bold text-base ${result.icloudLock.toLowerCase() === 'off' || result.icloudLock.toLowerCase() === 'unknown' ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {result.icloudLock}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      iCloud Lock Status
                    </p>
                  </div>
                </div>

                {/* Sim Lock */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                    <Globe size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                      SIM Lock
                    </p>
                    <p className="font-bold text-base text-gray-900">
                      {result.simLock}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Network Restriction
                    </p>
                  </div>
                </div>

                {/* Carrier */}
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50/50 border border-gray-100">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                      Carrier
                    </p>
                    <p className="font-bold text-base text-gray-900">
                      {result.carrier}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Original Network</p>
                  </div>
                </div>
              </div>

              {/* Verdict */}
              <div
                className={`p-6 border-t text-center ${result.verdictType === 'safe'
                  ? 'bg-green-50 border-green-100'
                  : result.verdictType === 'danger'
                    ? 'bg-red-50 border-red-100'
                    : 'bg-yellow-50 border-yellow-100'
                  }`}
              >
                <p
                  className={`font-bold text-base leading-relaxed ${result.verdictType === 'safe'
                    ? 'text-green-800'
                    : result.verdictType === 'danger'
                      ? 'text-red-800'
                      : 'text-yellow-800'
                    }`}
                >
                  {result.verdict}
                </p>
              </div>
            </div>

            <div className="text-center mt-8">
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setError(null);
                  setImei('');
                }}
                className="text-sm font-bold text-gray-500 hover:text-gray-900 inline-flex items-center gap-2"
              >
                <ScanBarcode size={16} />
                Check Another Device
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
