'use client';

import { Building2 } from 'lucide-react';
import { AirportOptions } from './AirportOptions';
import { DoorDeliveryQuotes } from './DoorDeliveryQuotes';
import { PickupDetails } from './PickupDetails';
import type { DeliveryMethod, ShippingQuote } from '../types';
import {
  getDoorDeliveryQuotes,
  getStationPickupAddressText,
  getStationPickupQuote,
  isStationPickupQuote,
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
    const selectedQuote = props.shippingQuotes.find(
      (quote) => String(quote.id) === String(props.selectedQuoteId),
    );
    const selectedStationQuote =
      selectedQuote && isStationPickupQuote(selectedQuote)
        ? selectedQuote
        : stationPickupQuote;

    if (!selectedStationQuote) {
      return null;
    }

    return (
      <div className="mt-6 rounded-xl border border-store-primary/20 bg-store-primary/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-store-primary/10 text-store-primary">
            <Building2 size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wide text-store-background-text/70">
              Pickup Stations (GIGL)
            </p>
            <h4 className="mt-1 text-sm font-bold text-store-background-text">
              {selectedStationQuote.stationName ||
                selectedStationQuote.displayName}
            </h4>
            <p className="mt-1 text-xs text-store-background-text/65">
              {getStationPickupAddressText(selectedStationQuote) ||
                'Collect from the selected GIGL service centre.'}
            </p>
            <p className="mt-3 text-sm font-bold text-store-background-text">
              ₦{selectedStationQuote.price.toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (props.deliveryMethod === 'airport') {
    return (
      <AirportOptions
        airportType={props.airportType}
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
