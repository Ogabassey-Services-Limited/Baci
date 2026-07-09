'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  DeliveryMethod,
  SavedAddress,
  ShippingLocation,
  ShippingQuote,
} from '../types';
import {
  invalidatePendingQuoteRequests,
  loadCheckoutShippingQuotes,
} from './checkout-shipping-quote-loader';

interface CartItem {
  name: string;
  quantity: number;
  price: number;
  negotiatedPrice?: number;
}

interface UseShippingOptions {
  merchantId?: string;
  deliveryMethod: DeliveryMethod;
  isNewAddressMode: boolean;
  newAddressState: string;
  newAddressCity: string;
  newAddressStreet: string;
  newAddressLatitude?: number;
  newAddressLongitude?: number;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerEmail: string;
  selectedAddressId: number;
  addresses: SavedAddress[];
  cart: CartItem[];
}

// Module-scope helpers keep try/finally and loading-flag updates out of the
// hook body so React Compiler can memoize the hook's consumers.
async function loadShippingStates(
  setShippingStates: (states: string[]) => void,
  setIsLoadingLocations: (loading: boolean) => void,
) {
  setIsLoadingLocations(true);
  try {
    const res = await fetch('/api/shipping/locations');
    if (res.ok) {
      const data = await res.json();
      setShippingStates(data.states || []);
    }
  } catch (error) {
    console.error('Failed to fetch states', error);
  } finally {
    setIsLoadingLocations(false);
  }
}

async function loadShippingCities(
  state: string,
  setShippingCities: (cities: string[]) => void,
) {
  try {
    const res = await fetch(
      `/api/shipping/locations?state=${encodeURIComponent(state)}`,
    );
    if (res.ok) {
      const data = await res.json();
      const cities = [
        ...new Set((data.locations as ShippingLocation[]).map((l) => l.city)),
      ].sort();
      setShippingCities(cities);
    }
  } catch (error) {
    console.error('Failed to fetch cities', error);
  }
}

export function useShipping({
  deliveryMethod,
  merchantId,
  isNewAddressMode,
  newAddressState,
  newAddressCity,
  newAddressStreet,
  newAddressLatitude,
  newAddressLongitude,
  customerPhone,
  firstName,
  lastName,
  customerEmail,
  selectedAddressId,
  addresses,
  cart,
}: UseShippingOptions) {
  const [shippingStates, setShippingStates] = useState<string[]>([]);
  const [shippingCities, setShippingCities] = useState<string[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>('');
  const [resolvedQuoteRequestKey, setResolvedQuoteRequestKey] = useState('');
  const quoteRequestSequence = useRef(0);
  const [prevAddressState, setPrevAddressState] = useState(newAddressState);

  // Clear stale cities during render when the selected state is cleared,
  // instead of waiting for an effect pass (react.dev: adjusting state when a
  // prop changes).
  if (newAddressState !== prevAddressState) {
    setPrevAddressState(newAddressState);
    if (!newAddressState) {
      setShippingCities([]);
    }
  }

  // Fetch States on mount
  useEffect(() => {
    loadShippingStates(setShippingStates, setIsLoadingLocations);
  }, []);

  // Fetch Cities when State changes
  useEffect(() => {
    if (!newAddressState) return;
    loadShippingCities(newAddressState, setShippingCities);
  }, [newAddressState]);

  // Function to fetch quotes
  const requestShippingQuotes = (
    address: string,
    state: string,
    city: string,
    phone: string,
    fName: string,
    lName: string,
    email: string,
    force: boolean,
  ) => {
    const deliveryPreference: 'door' | 'pickup_station' =
      deliveryMethod === 'pickup_station' ? 'pickup_station' : 'door';
    const receiver = {
      address,
      state,
      city,
      phone,
      fName,
      lName,
      email,
      merchantId,
      deliveryPreference,
      latitude: newAddressLatitude,
      longitude: newAddressLongitude,
    };
    return loadCheckoutShippingQuotes(
      receiver,
      cart,
      {
        currentRequestKey: resolvedQuoteRequestKey,
        force,
        requestSequence: quoteRequestSequence,
        setIsLoadingQuotes,
        setResolvedQuoteRequestKey,
        setSelectedQuoteId,
        setShippingQuotes,
      },
    );
  };
  const fetchShippingQuotes = (
    address: string,
    state: string,
    city: string,
    phone: string,
    fName: string,
    lName: string,
    email: string,
  ) => requestShippingQuotes(address, state, city, phone, fName, lName, email, true);

  // Trigger quote fetch when Door Delivery is selected and we have BOTH state AND city
  useEffect(() => {
    if (deliveryMethod === 'door' || deliveryMethod === 'pickup_station') {
      if (isNewAddressMode) {
        if (newAddressState && newAddressCity) {
          requestShippingQuotes(
            newAddressStreet || `${newAddressCity}, ${newAddressState}`,
            newAddressState,
            newAddressCity,
            customerPhone,
            firstName,
            lastName,
            customerEmail,
            false,
          );
        }
      } else {
        const saved = addresses.find((a) => a.id === selectedAddressId);
        if (saved) {
          const parts = saved.address.split(',').map((s) => s.trim());

          if (parts.length >= 2) {
            const stateCandidate = parts[parts.length - 1];
            const cityCandidate = parts[parts.length - 2];

            if (stateCandidate && cityCandidate) {
              requestShippingQuotes(
                saved.address,
                stateCandidate,
                cityCandidate,
                saved.phone,
                firstName,
                lastName,
                customerEmail,
                false,
              );
            }
          }
        }
      }
    }
  }, [
    deliveryMethod,
    selectedAddressId,
    isNewAddressMode,
    newAddressState,
    newAddressCity,
    addresses,
    cart,
    resolvedQuoteRequestKey,
  ]);

  const updateShippingQuotes = (quotes: ShippingQuote[]) => {
    setShippingQuotes(quotes);
    if (quotes.length === 0) {
      invalidatePendingQuoteRequests(quoteRequestSequence);
      setIsLoadingQuotes(false);
      setResolvedQuoteRequestKey('');
      setSelectedQuoteId('');
    }
  };

  return {
    shippingStates,
    shippingCities,
    isLoadingLocations,
    shippingQuotes,
    setShippingQuotes: updateShippingQuotes,
    isLoadingQuotes,
    selectedQuoteId,
    setSelectedQuoteId,
    fetchShippingQuotes,
  };
}
