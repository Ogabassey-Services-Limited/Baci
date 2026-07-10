'use client';

import { AUTO_FRACTION_OPTIONS } from '@/lib/currency';
import { formatAmountInCurrency } from '@/lib/resolve-merchant-currency';
import { SmartQuoteLoader } from '../../../components/SmartQuoteLoader';
import { AirportOptions } from './AirportOptions';
import { DoorDeliveryQuotes } from './DoorDeliveryQuotes';
import { PickupDetails } from './PickupDetails';
import type { DeliveryMethod, ShippingQuote } from '../types';
import {
  getDoorDeliveryQuotes,
  getStationPickupQuote,
  getStationPickupQuotes,
} from '../utils';

interface DeliveryMethodDetailsProps {
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (value: DeliveryMethod) => void;
  airportType: 'delivery' | 'pickup';
  setAirportType: (value: 'delivery' | 'pickup') => void;
  shippingQuotes: ShippingQuote[];
  isLoadingQuotes: boolean;
  selectedQuoteId: string;
  setSelectedQuoteId: (value: string) => void;
  fetchShippingQuotes: (
    address: string,
    state: string,
    city: string,
    phone: string,
    firstName: string,
    lastName: string,
    email: string,
  ) => void;
  newAddressStreet: string;
  newAddressState: string;
  newAddressCity: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerEmail: string;
}

export function DeliveryMethodDetails(props: DeliveryMethodDetailsProps) {
  const stationPickupQuote = getStationPickupQuote(props.shippingQuotes);

  if (props.deliveryMethod === 'pickup') {
    return <PickupDetails />;
  }

  if (props.deliveryMethod === 'pickup_station') {
    const stationPickupQuotes = getStationPickupQuotes(props.shippingQuotes);

    if (props.isLoadingQuotes) {
      return <SmartQuoteLoader />;
    }

    if (stationPickupQuotes.length === 0) {
      return (
        <p
          role="status"
          className="mt-6 rounded-xl border border-store-background-text/10 bg-store-background p-4 text-sm text-store-background-text/65"
        >
          No nearby GIG Logistics pickup station is available for this address
          yet.
        </p>
      );
    }

    return (
      <fieldset className="m-0 mt-6 min-w-0 border-0 p-0">
        <legend className="mb-3 text-xs font-bold uppercase tracking-wide text-store-background-text/70">
          Pickup Stations (GIGL)
        </legend>
        <div className="space-y-3">
          {stationPickupQuotes.map((quote) => (
            <label
              key={quote.id}
              className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-all hover:border-store-primary/60 ${
                props.selectedQuoteId === quote.id
                  ? 'border-store-primary bg-store-primary/5 ring-1 ring-store-primary'
                  : 'border-store-background-text/10 bg-store-background'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <input
                  type="radio"
                  name="station_pickup_quote"
                  checked={props.selectedQuoteId === quote.id}
                  onChange={() => props.setSelectedQuoteId(quote.id)}
                  className="mt-0.5 size-4 border-store-background-text/25 text-store-primary focus:ring-store-primary"
                />
                <div className="min-w-0">
                  <span className="text-sm font-bold text-store-background-text">
                    {quote.stationName || quote.displayName}
                  </span>
                  <p className="mt-0.5 text-xs text-store-background-text/65">
                    {quote.stationAddress ||
                      'Collect from the selected GIGL service centre.'}
                  </p>
                </div>
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
      </fieldset>
    );
  }

  if (props.deliveryMethod === 'airport') {
    return (
      <AirportOptions
        airportType={props.airportType}
        destinationCity={props.newAddressCity}
        setAirportType={props.setAirportType}
      />
    );
  }

  return (
    <DoorDeliveryQuotes
      {...props}
      shippingQuotes={getDoorDeliveryQuotes(props.shippingQuotes)}
      stationPickupQuote={stationPickupQuote}
      onSelectStationPickup={(quoteId) => {
        props.setSelectedQuoteId(quoteId);
        props.setDeliveryMethod('pickup_station');
      }}
    />
  );
}
