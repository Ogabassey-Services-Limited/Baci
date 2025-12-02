'use client';

import { Clock, Truck, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';

interface ShippingOption {
  id: string;
  provider: string;
  name: string;
  description: string;
  price: number;
  estimated_days_min: number;
  estimated_days_max: number;
  is_express?: boolean;
}

interface ShippingSelectorProps {
  merchantId: string;
  destinationState: string;
  destinationCity?: string;
  cartTotal: number;
  cartWeight?: number;
  onSelect: (option: ShippingOption) => void;
  selectedId?: string;
}

export function ShippingSelector({
  merchantId,
  destinationState,
  destinationCity,
  cartTotal,
  cartWeight,
  onSelect,
  selectedId,
}: ShippingSelectorProps) {
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchShippingOptions = async () => {
      if (!destinationState) {
        setOptions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          merchant_id: merchantId,
          destination_state: destinationState,
          cart_total: cartTotal.toString(),
        });

        if (destinationCity) {
          params.set('destination_city', destinationCity);
        }
        if (cartWeight) {
          params.set('weight', cartWeight.toString());
        }

        const response = await fetch(
          `/api/storefront/shipping/rates?${params}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch shipping options');
        }

        const data = await response.json();
        setOptions(data.options || []);

        // Auto-select cheapest option if none selected
        if (data.options?.length > 0 && !selectedId) {
          const cheapest = data.options.reduce(
            (min: ShippingOption, opt: ShippingOption) =>
              opt.price < min.price ? opt : min
          );
          onSelect(cheapest);
        }
      } catch (err) {
        console.error('Error fetching shipping options:', err);
        setError('Unable to load shipping options');

        // Provide fallback options
        const fallbackOptions: ShippingOption[] = [
          {
            id: 'standard',
            provider: 'standard',
            name: 'Standard Delivery',
            description: 'Delivery within 3-7 business days',
            price: destinationState?.toLowerCase().includes('lagos')
              ? 1500
              : 2500,
            estimated_days_min: 3,
            estimated_days_max: 7,
          },
          {
            id: 'express',
            provider: 'express',
            name: 'Express Delivery',
            description: 'Delivery within 1-3 business days',
            price: destinationState?.toLowerCase().includes('lagos')
              ? 2500
              : 4000,
            estimated_days_min: 1,
            estimated_days_max: 3,
            is_express: true,
          },
        ];
        setOptions(fallbackOptions);
        if (!selectedId) {
          onSelect(fallbackOptions[0]);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchShippingOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    merchantId,
    destinationState,
    destinationCity,
    cartTotal,
    cartWeight,
    onSelect,
    selectedId,
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getDeliveryEstimate = (option: ShippingOption) => {
    if (option.estimated_days_min === option.estimated_days_max) {
      return `${option.estimated_days_min} day${option.estimated_days_min > 1 ? 's' : ''}`;
    }
    return `${option.estimated_days_min}-${option.estimated_days_max} days`;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Label>Shipping Method</Label>
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error && options.length === 0) {
    return (
      <div className="space-y-3">
        <Label>Shipping Method</Label>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="space-y-3">
        <Label>Shipping Method</Label>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              Please enter your delivery address to see shipping options
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Label>Shipping Method</Label>
      <RadioGroup
        value={selectedId}
        onValueChange={(value) => {
          const option = options.find((o) => o.id === value);
          if (option) onSelect(option);
        }}
      >
        {options.map((option) => (
          <Card
            key={option.id}
            className={`cursor-pointer transition-colors ${
              selectedId === option.id
                ? 'border-primary ring-1 ring-primary'
                : 'hover:border-primary/50'
            }`}
            onClick={() => onSelect(option)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <RadioGroupItem
                  value={option.id}
                  id={option.id}
                  className="sr-only"
                />

                <div className="flex-shrink-0">
                  {option.is_express ? (
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Zap className="h-5 w-5 text-amber-600" />
                    </div>
                  ) : (
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Truck className="h-5 w-5 text-blue-600" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{option.name}</span>
                    {option.is_express && (
                      <Badge variant="secondary" className="text-xs">
                        Fastest
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Est. {getDeliveryEstimate(option)}</span>
                  </div>
                </div>

                <div className="text-right">
                  {option.price === 0 ? (
                    <span className="font-semibold text-green-600">FREE</span>
                  ) : (
                    <span className="font-semibold">
                      {formatCurrency(option.price)}
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>
    </div>
  );
}
