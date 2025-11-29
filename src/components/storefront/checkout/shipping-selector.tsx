'use client';

/**
 * Shipping Selector Component
 *
 * 2025 Best Practices Applied:
 * - Delivery DATES over shipping speed (more actionable for customers)
 * - Cheapest/Fastest tabs for easy comparison
 * - Transparent pricing with no hidden fees
 * - Mobile-first responsive design
 * - Loading skeletons for perceived performance
 * - Clear visual hierarchy
 */

import { useState, useEffect, useCallback } from 'react';
import { Truck, Zap, Clock, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/hooks/use-currency';
import type { ShippingQuote } from '@/lib/shipping/types';
import type { ShippingSelectorProps, ShippingTab } from './types';

// Provider logo mapping (for future use)
// const PROVIDER_LOGOS: Record<string, string> = {
//   GIGL: '/logos/gigl.png',
//   TOPSHIP: '/logos/topship.png',
//   SHIIP: '/logos/shiip.png',
// };

// Delivery tier icons
const TIER_ICONS: Record<string, typeof Truck> = {
  express: Zap,
  premium: Zap,
  standard: Truck,
  economy: Package,
};

/**
 * Calculate estimated delivery date from today
 */
function getDeliveryDate(estimatedDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + estimatedDays);

  // Format: "Mon, Dec 15"
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get delivery date range string
 */
function getDeliveryDateRange(minDays?: number, maxDays?: number, estimatedDays?: number): string {
  if (minDays && maxDays && minDays !== maxDays) {
    return `${getDeliveryDate(minDays)} - ${getDeliveryDate(maxDays)}`;
  }
  return getDeliveryDate(estimatedDays || minDays || 3);
}

/**
 * Sort quotes by price (cheapest first)
 */
function sortByCheapest(quotes: ShippingQuote[]): ShippingQuote[] {
  return [...quotes].sort((a, b) => a.price - b.price);
}

/**
 * Sort quotes by delivery time (fastest first)
 */
function sortByFastest(quotes: ShippingQuote[]): ShippingQuote[] {
  return [...quotes].sort((a, b) => (a.estimatedDays || 999) - (b.estimatedDays || 999));
}

/**
 * Shipping Quote Card Component
 */
function ShippingQuoteCard({
  quote,
  isSelected,
  onSelect,
  formatCurrency,
}: {
  quote: ShippingQuote;
  isSelected: boolean;
  onSelect: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const Icon = TIER_ICONS[quote.serviceTier?.toLowerCase()] || Truck;
  const deliveryDate = getDeliveryDateRange(quote.minDays, quote.maxDays, quote.estimatedDays);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md',
        'border-2',
        isSelected
          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
          : 'border-border hover:border-primary/50'
      )}
      onClick={onSelect}
      role="radio"
      aria-checked={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Details */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                'p-2 rounded-lg shrink-0',
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              {/* Carrier Name */}
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm truncate">
                  {quote.carrierName || quote.displayName}
                </h4>
                {isSelected && (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>

              {/* Service Tier */}
              <p className="text-xs text-muted-foreground capitalize">
                {quote.serviceTier?.replace(/_/g, ' ') || 'Standard'}
              </p>

              {/* Delivery Date - KEY 2025 BEST PRACTICE */}
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">
                  Arrives {deliveryDate}
                </span>
              </div>

              {/* Station Pickup Notice */}
              {quote.isStationPickup && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Pickup at {quote.stationName || 'station'}
                </p>
              )}

              {/* Features */}
              <div className="flex flex-wrap gap-2 mt-2">
                {quote.pickupIncluded && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                    Free pickup
                  </span>
                )}
                {quote.insuranceIncluded && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Insured
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Price */}
          <div className="text-right shrink-0">
            <p className="font-bold text-lg">{formatCurrency(quote.price)}</p>
            <p className="text-xs text-muted-foreground">
              {quote.estimatedDays === 1
                ? '1 day'
                : `${quote.estimatedDays || '3-5'} days`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Loading Skeleton for shipping quotes
 */
function ShippingQuoteSkeleton() {
  return (
    <Card className="border-2">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40 mt-2" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Main Shipping Selector Component
 */
export function ShippingSelector({
  receiverAddress,
  items,
  onSelect,
  selectedQuoteId,
  className,
  isLoading: externalLoading,
}: ShippingSelectorProps) {
  const [quotes, setQuotes] = useState<ShippingQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ShippingTab>('cheapest');
  const { formatCurrency } = useCurrency();

  // Fetch shipping quotes
  const fetchQuotes = useCallback(async () => {
    // Validate address
    if (!receiverAddress.city || !receiverAddress.state || !receiverAddress.address) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/shipping/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver: {
            name: receiverAddress.name || 'Customer',
            phone: receiverAddress.phone || '',
            email: receiverAddress.email,
            address: receiverAddress.address,
            city: receiverAddress.city,
            state: receiverAddress.state,
            country: receiverAddress.country || 'Nigeria',
            countryCode: receiverAddress.countryCode || 'NG',
          },
          items: items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            weight: item.weight || 1,
            value: item.value,
            category: item.category,
          })),
          shipmentType: 'domestic',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch shipping quotes');
      }

      const data = await response.json();

      if (data.quotes?.all && data.quotes.all.length > 0) {
        setQuotes(data.quotes.all);

        // Auto-select cheapest option if nothing selected
        if (!selectedQuoteId) {
          const cheapest = sortByCheapest(data.quotes.all)[0];
          if (cheapest) {
            onSelect(cheapest);
          }
        }
      } else {
        setError('No shipping options available for this address');
      }
    } catch (err) {
      console.error('Error fetching shipping quotes:', err);
      setError('Unable to load shipping options. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [receiverAddress, items, selectedQuoteId, onSelect]);

  // Fetch quotes when address changes
  useEffect(() => {
    const debounce = setTimeout(fetchQuotes, 500);
    return () => clearTimeout(debounce);
  }, [fetchQuotes]);

  const isLoading = loading || externalLoading;

  // Sort quotes based on active tab (computed inline in TabsContent below)
  // const sortedQuotes = activeTab === 'cheapest' ? sortByCheapest(quotes) : sortByFastest(quotes);

  // Get best options for tab labels
  const cheapestPrice = quotes.length > 0 ? Math.min(...quotes.map((q) => q.price)) : 0;
  const fastestDays = quotes.length > 0 ? Math.min(...quotes.map((q) => q.estimatedDays || 999)) : 0;

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Options
        </h3>
        {quotes.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {quotes.length} option{quotes.length !== 1 ? 's' : ''} available
          </span>
        )}
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">{error}</p>
              <button
                onClick={fetchQuotes}
                className="text-sm text-primary hover:underline mt-1"
              >
                Try again
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          <ShippingQuoteSkeleton />
          <ShippingQuoteSkeleton />
          <ShippingQuoteSkeleton />
        </div>
      )}

      {/* Quotes Display */}
      {!isLoading && quotes.length > 0 && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ShippingTab)}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="cheapest" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span>Cheapest</span>
              {cheapestPrice > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded ml-1">
                  {formatCurrency(cheapestPrice)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="fastest" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span>Fastest</span>
              {fastestDays > 0 && fastestDays < 999 && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-1">
                  {fastestDays}d
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="cheapest" className="space-y-3 mt-0">
            {sortByCheapest(quotes).map((quote) => (
              <ShippingQuoteCard
                key={quote.id}
                quote={quote}
                isSelected={selectedQuoteId === quote.id}
                onSelect={() => onSelect(quote)}
                formatCurrency={formatCurrency}
              />
            ))}
          </TabsContent>

          <TabsContent value="fastest" className="space-y-3 mt-0">
            {sortByFastest(quotes).map((quote) => (
              <ShippingQuoteCard
                key={quote.id}
                quote={quote}
                isSelected={selectedQuoteId === quote.id}
                onSelect={() => onSelect(quote)}
                formatCurrency={formatCurrency}
              />
            ))}
          </TabsContent>
        </Tabs>
      )}

      {/* Empty State - Address needed */}
      {!isLoading && quotes.length === 0 && !error && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Truck className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Enter your delivery address to see available shipping options
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ShippingSelector;
