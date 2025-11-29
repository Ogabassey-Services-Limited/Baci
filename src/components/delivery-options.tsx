'use client';

import { useState, useEffect } from 'react';
import { Loader2, Truck, Clock, Shield, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiPost } from '@/lib/api-client';

// =============================================================================
// TYPES
// =============================================================================

interface ShippingQuote {
  id: string;
  provider: 'GIGL' | 'TOPSHIP' | 'SHIIP';
  serviceTier: string;
  carrierName: string;
  displayName: string;
  estimatedDays: number;
  minDays?: number;
  maxDays?: number;
  price: number;
  currency: string;
  pickupIncluded: boolean;
  insuranceIncluded: boolean;
  isStationPickup?: boolean;
  stationName?: string;
  stationAddress?: string;
  providerRateId?: string;
  expiresAt: string;
}

interface QuoteResponse {
  quotes: {
    featured: ShippingQuote[];
    all: ShippingQuote[];
  };
  sessionId: string;
  expiresAt: string;
  warnings?: string[];
}

interface DeliveryOptionsProps {
  receiver: {
    name: string;
    email?: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    country?: string;
    countryCode?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    weight?: number;
    value: number;
  }>;
  onSelect: (quote: ShippingQuote, sessionId: string) => void;
  selectedQuoteId?: string;
  formatCurrency: (value: number) => string;
}

// =============================================================================
// DELIVERY OPTIONS COMPONENT
// =============================================================================

export function DeliveryOptions({
  receiver,
  items,
  onSelect,
  selectedQuoteId,
  formatCurrency,
}: DeliveryOptionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(null);
  const [showAllOptions, setShowAllOptions] = useState(false);

  // Fetch quotes when receiver info changes
  useEffect(() => {
    const fetchQuotes = async () => {
      if (!receiver.address || !receiver.city || !receiver.state) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiPost<QuoteResponse>('/api/shipping/quotes', {
          receiver: {
            name: receiver.name,
            email: receiver.email,
            phone: receiver.phone,
            address: receiver.address,
            city: receiver.city,
            state: receiver.state,
            country: receiver.country || 'Nigeria',
            countryCode: receiver.countryCode || 'NG',
          },
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            weight: item.weight || 1,
            value: item.value,
          })),
          shipmentType: 'domestic',
        });

        setQuoteResponse(response);

        // Auto-select the first featured quote if nothing selected
        if (!selectedQuoteId && response.quotes.featured.length > 0) {
          onSelect(response.quotes.featured[0], response.sessionId);
        }
      } catch (err) {
        console.error('Failed to fetch shipping quotes:', err);
        setError('Unable to fetch delivery options. Using default shipping.');
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchQuotes, 500);
    return () => clearTimeout(debounce);
  }, [receiver.address, receiver.city, receiver.state, receiver.name, receiver.phone, receiver.email, receiver.country, receiver.countryCode, items, onSelect, selectedQuoteId]);

  // Format delivery estimate
  const formatDeliveryTime = (quote: ShippingQuote) => {
    if (quote.minDays && quote.maxDays && quote.minDays !== quote.maxDays) {
      return `${quote.minDays}-${quote.maxDays} business days`;
    }
    return `${quote.estimatedDays} business day${quote.estimatedDays > 1 ? 's' : ''}`;
  };

  // Get badge for quote type
  const getQuoteBadge = (quote: ShippingQuote, index: number) => {
    if (index === 0) return { label: 'Best Value', variant: 'default' as const };
    if (quote.estimatedDays <= 2) return { label: 'Fastest', variant: 'secondary' as const };
    if (quote.isStationPickup) return { label: 'Pickup Point', variant: 'outline' as const };
    return null;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Finding best delivery options...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !quoteResponse) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!quoteResponse) {
    return null;
  }

  const { quotes, sessionId } = quoteResponse;
  const displayQuotes = showAllOptions ? quotes.all : quotes.featured;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Options
        </h3>
        {quotes.all.length > quotes.featured.length && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAllOptions(!showAllOptions)}
            className="text-sm"
          >
            {showAllOptions ? (
              <>
                Show Less <ChevronUp className="ml-1 h-4 w-4" />
              </>
            ) : (
              <>
                {quotes.all.length - quotes.featured.length} more options <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>

      <RadioGroup
        value={selectedQuoteId}
        onValueChange={(id) => {
          const quote = quotes.all.find(q => q.id === id);
          if (quote) {
            onSelect(quote, sessionId);
          }
        }}
        className="space-y-3"
      >
        {displayQuotes.map((quote, index) => {
          const badge = getQuoteBadge(quote, index);
          const isSelected = selectedQuoteId === quote.id;

          return (
            <Label
              key={quote.id}
              htmlFor={quote.id}
              className={cn(
                "flex cursor-pointer rounded-lg border p-4 transition-all hover:bg-muted/50",
                isSelected ? "border-primary bg-primary/5" : "border-border"
              )}
            >
              <RadioGroupItem value={quote.id} id={quote.id} className="sr-only" />

              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{quote.carrierName}</span>
                      {badge && (
                        <Badge variant={badge.variant} className="text-xs">
                          {badge.label}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDeliveryTime(quote)}
                      </span>
                      {quote.insuranceIncluded && (
                        <span className="flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" />
                          Incl. transit insurance
                        </span>
                      )}
                    </div>

                    {quote.isStationPickup && quote.stationName && (
                      <div className="flex items-start gap-1 text-sm text-amber-600 mt-2">
                        <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Pickup at: {quote.stationName}</p>
                          {quote.stationAddress && (
                            <p className="text-xs text-muted-foreground">{quote.stationAddress}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-lg">{formatCurrency(quote.price)}</p>
                    {quote.pickupIncluded && (
                      <p className="text-xs text-muted-foreground">Free pickup</p>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  "ml-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                  isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                )}
              >
                {isSelected && (
                  <div className="h-2 w-2 rounded-full bg-white" />
                )}
              </div>
            </Label>
          );
        })}
      </RadioGroup>

      {quoteResponse.warnings && quoteResponse.warnings.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Note: Some delivery options may be unavailable.
        </p>
      )}
    </div>
  );
}

// =============================================================================
// DELIVERY SUMMARY COMPONENT (for order confirmation)
// =============================================================================

interface DeliverySummaryProps {
  quote: ShippingQuote;
  formatCurrency: (value: number) => string;
}

export function DeliverySummary({ quote, formatCurrency }: DeliverySummaryProps) {
  const formatDeliveryTime = (q: ShippingQuote) => {
    if (q.minDays && q.maxDays && q.minDays !== q.maxDays) {
      return `${q.minDays}-${q.maxDays} business days`;
    }
    return `${q.estimatedDays} business day${q.estimatedDays > 1 ? 's' : ''}`;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Truck className="h-6 w-6 text-muted-foreground" />
            <div>
              <p className="font-semibold">{quote.carrierName}</p>
              <p className="text-sm text-muted-foreground">
                {formatDeliveryTime(quote)}
                {quote.insuranceIncluded && ' · Incl. transit insurance'}
              </p>
              {quote.isStationPickup && quote.stationName && (
                <p className="text-sm text-amber-600 flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Pickup at: {quote.stationName}
                </p>
              )}
            </div>
          </div>
          <p className="font-semibold">{formatCurrency(quote.price)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
