'use client';

import { AirportOptions } from './AirportOptions';
import { DoorDeliveryQuotes } from './DoorDeliveryQuotes';
import { PickupDetails } from './PickupDetails';
import type { DeliveryMethod, ShippingQuote } from '../types';

interface DeliveryMethodDetailsProps {
  deliveryMethod: DeliveryMethod;
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
  if (props.deliveryMethod === 'pickup') {
    return <PickupDetails />;
  }

  if (props.deliveryMethod === 'airport') {
    return (
      <AirportOptions
        airportType={props.airportType}
        setAirportType={props.setAirportType}
      />
    );
  }

  return <DoorDeliveryQuotes {...props} />;
}
