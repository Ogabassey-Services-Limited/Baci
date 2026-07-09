'use client';

import { Plane } from 'lucide-react';
import { AIRPORT_DELIVERY_CONFIG } from '@/components/storefront/ogabassey/config/checkout/airport-delivery';
import { AirportOption } from './AirportOption';

interface AirportOptionsProps {
  airportType: 'delivery' | 'pickup';
  destinationCity: string;
  setAirportType: (value: 'delivery' | 'pickup') => void;
}

export function AirportOptions({
  airportType,
  destinationCity,
  setAirportType,
}: AirportOptionsProps) {
  const location = destinationCity.trim();
  return (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className="flex items-start gap-3">
        <Plane size={20} className="text-store-background-text/50 mt-0.5" />
        <p className="text-sm text-store-background-text/60">
          Delivery to your doorstep is available. Choose delivery to your
          location or pickup at the airport.
        </p>
      </div>
      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Airport delivery preference</legend>
        <AirportOption
          type="delivery"
          label={location ? `${location} Airport Delivery` : 'Airport Delivery'}
          description="Delivery to your doorstep"
          price={AIRPORT_DELIVERY_CONFIG.delivery.priceLabel}
          airportType={airportType}
          setAirportType={setAirportType}
        />
        <AirportOption
          type="pickup"
          label={location ? `${location} Airport Pickup` : 'Airport Pickup'}
          description="Collect at the airport"
          price={AIRPORT_DELIVERY_CONFIG.pickup.priceLabel}
          airportType={airportType}
          setAirportType={setAirportType}
        />
      </fieldset>
    </div>
  );
}
