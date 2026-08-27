import { Plane } from 'lucide-react';
import { AUTO_FRACTION_OPTIONS } from '@/lib/currency';
import { formatAmountInCurrency } from '@/lib/resolve-merchant-currency';
import type { ShippingQuote } from '../types';

type AirportType = 'delivery' | 'pickup';

interface AirportDeliveryOptionsProps {
  airportType: AirportType;
  city: string;
  state: string;
  selectedQuoteId: string;
  selectedQuoteMatchesDeliveryMethod: boolean;
  airDeliveryQuotes: ShippingQuote[];
  onSelectAirportType: (airportType: AirportType) => void;
  onSelectQuote: (quoteId: string) => void;
}

export function AirportDeliveryOptions({
  airportType,
  city,
  state,
  selectedQuoteId,
  selectedQuoteMatchesDeliveryMethod,
  airDeliveryQuotes,
  onSelectAirportType,
  onSelectQuote,
}: AirportDeliveryOptionsProps) {
  const localAirportTypeSelected = !selectedQuoteMatchesDeliveryMethod;

  return (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className="flex items-start gap-3">
        <Plane size={20} className="text-store-background-text/50 mt-0.5" />
        <p className="text-sm text-store-background-text/60">
          Delivery to your doorstep is available. Choose delivery to your
          location or pickup at the airport.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
            airportType === 'delivery' && localAirportTypeSelected
              ? 'border-store-primary bg-store-primary/5'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="airportType"
            value="delivery"
            checked={airportType === 'delivery' && localAirportTypeSelected}
            onChange={() => onSelectAirportType('delivery')}
            className="sr-only"
          />
          <div
            className={`size-5 rounded-full border-2 flex items-center justify-center ${
              airportType === 'delivery' && localAirportTypeSelected
                ? 'border-store-primary'
                : 'border-gray-400'
            }`}
          >
            {airportType === 'delivery' && localAirportTypeSelected && (
              <div className="size-2.5 rounded-full bg-store-primary" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-store-background-text text-sm">
              {city || state
                ? `${city || state} Airport Delivery`
                : 'Airport Delivery'}
            </p>
            <p className="text-xs text-store-background-text/55 mt-0.5">
              Delivery to your doorstep
            </p>
          </div>
          <span className="font-bold text-store-background-text">₦35,000</span>
        </label>
        <label
          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
            airportType === 'pickup' && localAirportTypeSelected
              ? 'border-store-primary bg-store-primary/5'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300'
          }`}
        >
          <input
            type="radio"
            name="airportType"
            value="pickup"
            checked={airportType === 'pickup' && localAirportTypeSelected}
            onChange={() => onSelectAirportType('pickup')}
            className="sr-only"
          />
          <div
            className={`size-5 rounded-full border-2 flex items-center justify-center ${
              airportType === 'pickup' && localAirportTypeSelected
                ? 'border-store-primary'
                : 'border-gray-400'
            }`}
          >
            {airportType === 'pickup' && localAirportTypeSelected && (
              <div className="size-2.5 rounded-full bg-store-primary" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-bold text-store-background-text text-sm">
              Airport Pickup
            </p>
            <p className="text-xs text-store-background-text/55 mt-0.5">
              Collect at the airport
            </p>
          </div>
          <span className="font-bold text-store-background-text">₦20,000</span>
        </label>
      </div>
      {airDeliveryQuotes.map((quote) => (
        <label
          key={quote.id}
          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-4 transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
            selectedQuoteId === quote.id
              ? 'border-store-primary bg-store-primary/5'
              : 'border-store-background-text/10 bg-store-background hover:border-store-primary/40'
          }`}
        >
          <input
            type="radio"
            name="airportType"
            checked={selectedQuoteId === quote.id}
            onChange={() => onSelectQuote(quote.id)}
            className="size-4 border-store-background-text/25 text-store-primary focus:ring-store-primary"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-store-background-text">
              {quote.displayName}
            </p>
            <p className="mt-0.5 text-xs text-store-background-text/55">
              GIG Logistics GoFaster (Air/Cargo)
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold text-store-background-text">
            {formatAmountInCurrency(
              quote.price,
              quote.currency,
              AUTO_FRACTION_OPTIONS,
            )}
          </span>
        </label>
      ))}
    </div>
  );
}
