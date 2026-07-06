'use client';

import { useEffect, useState } from 'react';
import { normalizeShippingQuoteResponse } from '@/lib/shipping/quote-response';
import type {
  DeliveryMethod,
  SavedAddress,
  ShippingLocation,
  ShippingQuote,
} from '../types';
import { getPreferredDoorQuoteId } from '../utils';

interface CartItem {
  name: string;
  quantity: number;
  price: number;
  negotiatedPrice?: number;
}

interface UseShippingOptions {
  deliveryMethod: DeliveryMethod;
  isNewAddressMode: boolean;
  newAddressState: string;
  newAddressCity: string;
  newAddressStreet: string;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerEmail: string;
  selectedAddressId: number;
  addresses: SavedAddress[];
  cart: CartItem[];
}

interface QuoteReceiver {
  address: string;
  state: string;
  city: string;
  phone: string;
  fName: string;
  lName: string;
  email: string;
}

interface ShippingQuoteSetters {
  setIsLoadingQuotes: (loading: boolean) => void;
  setSelectedQuoteId: (id: string) => void;
  setShippingQuotes: (quotes: ShippingQuote[]) => void;
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

async function loadShippingQuotes(
  receiver: QuoteReceiver,
  cart: CartItem[],
  { setIsLoadingQuotes, setSelectedQuoteId, setShippingQuotes }: ShippingQuoteSetters,
) {
  const { address, state, city, phone, fName, lName, email } = receiver;
  if (!state || !city || !address) return;

  setIsLoadingQuotes(true);
  setSelectedQuoteId('');

  try {
    const res = await fetch('/api/shipping/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        receiver: {
          name: `${fName} ${lName}`.trim() || 'Valued Customer',
          email: email || 'guest@example.com',
          phone: phone || '',
          address,
          city,
          state,
          country: 'Nigeria',
        },
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          weight: 1,
          value: item.negotiatedPrice || item.price,
        })),
      }),
    });

    if (res.ok) {
      const data: unknown = await res.json();
      const { quotes } = normalizeShippingQuoteResponse(data);
      setShippingQuotes(quotes);

      const preferredDoorQuoteId = getPreferredDoorQuoteId(quotes);
      if (preferredDoorQuoteId) {
        setSelectedQuoteId(preferredDoorQuoteId);
      }
    } else {
      console.warn('Failed to fetch quotes:', await res.text());
    }
  } catch (error) {
    console.error('Error fetching shipping quotes:', error);
  } finally {
    setIsLoadingQuotes(false);
  }
}

export function useShipping({
  deliveryMethod,
  isNewAddressMode,
  newAddressState,
  newAddressCity,
  newAddressStreet,
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
  const fetchShippingQuotes = (
    address: string,
    state: string,
    city: string,
    phone: string,
    fName: string,
    lName: string,
    email: string,
  ) =>
    loadShippingQuotes({ address, state, city, phone, fName, lName, email }, cart, {
      setIsLoadingQuotes,
      setSelectedQuoteId,
      setShippingQuotes,
    });

  // Trigger quote fetch when Door Delivery is selected and we have BOTH state AND city
  useEffect(() => {
    if (deliveryMethod === 'door') {
      if (isNewAddressMode) {
        if (newAddressState && newAddressCity) {
          fetchShippingQuotes(
            newAddressStreet || `${newAddressCity}, ${newAddressState}`,
            newAddressState,
            newAddressCity,
            customerPhone,
            firstName,
            lastName,
            customerEmail,
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
              fetchShippingQuotes(
                saved.address,
                stateCandidate,
                cityCandidate,
                saved.phone,
                firstName,
                lastName,
                customerEmail,
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
  ]);

  return {
    shippingStates,
    shippingCities,
    isLoadingLocations,
    shippingQuotes,
    setShippingQuotes,
    isLoadingQuotes,
    selectedQuoteId,
    setSelectedQuoteId,
    fetchShippingQuotes,
  };
}
