'use client';

import { Check, ChevronDown, ChevronUp, Loader2, Phone, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface NetworkProvider {
  id: string;
  name: string;
  color: string;
}

interface AirtimeAddonProps {
  merchantSlug: string;
  quickAmounts?: number[];
  onAirtimeAdded?: (
    amount: number,
    phoneNumber: string,
    provider: string
  ) => void;
  className?: string;
}

const NETWORK_PROVIDERS: NetworkProvider[] = [
  { id: 'MTN', name: 'MTN', color: '#FFCC00' },
  { id: 'AIRTEL', name: 'Airtel', color: '#FF0000' },
  { id: 'GLO', name: 'Glo', color: '#00FF00' },
  { id: '9MOBILE', name: '9mobile', color: '#006400' },
];

export function AirtimeAddon({
  merchantSlug,
  quickAmounts = [100, 200, 500, 1000],
  onAirtimeAdded,
  className,
}: AirtimeAddonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [isLoading, _setIsLoading] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detect network provider from phone number
  useEffect(() => {
    const detectNetwork = async () => {
      if (phoneNumber.length >= 4) {
        try {
          const response = await fetch('/api/vtu/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber }),
          });
          const data = await response.json();
          if (data.detected && data.provider) {
            setDetectedProvider(data.provider);
            setSelectedProvider(data.provider);
          }
        } catch {
          // Ignore detection errors
        }
      }
    };

    detectNetwork();
  }, [phoneNumber]);

  const handleQuickAmountSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    setError(null);
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
    setError(null);
  };

  const getFinalAmount = () => {
    if (selectedAmount) return selectedAmount;
    const parsed = Number.parseInt(customAmount, 10);
    return parsed >= 50 && parsed <= 50000 ? parsed : 0;
  };

  const handlePurchase = async () => {
    const amount = getFinalAmount();

    if (!amount) {
      setError('Please select or enter an amount');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    if (!selectedProvider) {
      setError('Please select a network provider');
      return;
    }

    setIsPurchasing(true);
    setError(null);

    try {
      const response = await fetch('/api/vtu/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantSlug,
          phoneNumber,
          amount,
          type: 'airtime',
          networkProvider: selectedProvider,
          source: 'checkout',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setPurchaseSuccess(true);
        onAirtimeAdded?.(amount, phoneNumber, selectedProvider);
        // Reset after 3 seconds
        setTimeout(() => {
          setPurchaseSuccess(false);
          setSelectedAmount(null);
          setCustomAmount('');
          setPhoneNumber('');
          setSelectedProvider('');
          setIsExpanded(false);
        }, 3000);
      } else {
        setError(data.error || 'Purchase failed. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  };

  const amount = getFinalAmount();

  return (
    <div className={cn('border rounded-lg overflow-hidden', className)}>
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
            <Phone className="h-5 w-5" />
          </div>
          <div className="text-left">
            <p className="font-medium">Add Airtime to Your Order?</p>
            <p className="text-sm text-muted-foreground">
              Quick recharge for any network
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-background">
          {purchaseSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="font-medium text-lg">Airtime Sent!</p>
              <p className="text-sm text-muted-foreground">
                ₦{amount.toLocaleString()} sent to {phoneNumber}
              </p>
            </div>
          ) : (
            <>
              {/* Quick Amount Selection */}
              <div>
                <Label className="text-sm">Quick Select</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickAmounts.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => handleQuickAmountSelect(amt)}
                      className={cn(
                        'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                        selectedAmount === amt
                          ? 'bg-green-500 text-white'
                          : 'bg-muted hover:bg-muted/80'
                      )}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount */}
              <div>
                <Label htmlFor="custom-amount" className="text-sm">
                  Or Enter Custom Amount
                </Label>
                <Input
                  id="custom-amount"
                  type="number"
                  placeholder="e.g., 2500"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  min={50}
                  max={50000}
                  className="mt-1"
                />
              </div>

              {/* Phone Number */}
              <div>
                <Label htmlFor="phone-number" className="text-sm">
                  Phone Number
                </Label>
                <Input
                  id="phone-number"
                  type="tel"
                  placeholder="08012345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="mt-1"
                />
                {detectedProvider && (
                  <p className="text-xs text-green-600 mt-1">
                    Detected: {detectedProvider}
                  </p>
                )}
              </div>

              {/* Network Provider */}
              <div>
                <Label className="text-sm">Network</Label>
                <Select
                  value={selectedProvider}
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select network" />
                  </SelectTrigger>
                  <SelectContent>
                    {NETWORK_PROVIDERS.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: provider.color }}
                          />
                          {provider.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                  <X className="h-4 w-4" />
                  {error}
                </div>
              )}

              {/* Purchase Button */}
              <Button
                onClick={handlePurchase}
                disabled={!amount || isPurchasing || isLoading}
                className="w-full bg-green-500 hover:bg-green-600"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Phone className="mr-2 h-4 w-4" />
                    Add ₦{amount ? amount.toLocaleString() : '0'} Airtime
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Airtime is delivered instantly to the phone number above
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
