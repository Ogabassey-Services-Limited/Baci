'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import type { DeliveryMethod, SavedAddress, ShippingQuote } from '../types';
import { inferAddressLocationFromInput } from '../utils';

interface DeliveryAddressSectionProps {
  user: { id: string } | null | undefined;
  addresses: SavedAddress[];
  isNewAddressMode: boolean;
  setIsNewAddressMode: (value: boolean) => void;
  selectedAddressId: number;
  setSelectedAddressId: (value: number) => void;
  newAddressStreet: string;
  newAddressState: string;
  newAddressCity: string;
  setNewAddressStreet: (value: string) => void;
  setNewAddressState: (value: string) => void;
  setNewAddressCity: (value: string) => void;
  shippingStates: string[];
  shippingCities: string[];
  isLoadingLocations: boolean;
  setShippingQuotes: (value: ShippingQuote[]) => void;
  setSelectedQuoteId: (value: string) => void;
  setDeliveryMethod: (value: DeliveryMethod) => void;
  isHydrated: boolean;
}

export function DeliveryAddressSection({
  user,
  addresses,
  isNewAddressMode,
  setIsNewAddressMode,
  selectedAddressId,
  setSelectedAddressId,
  newAddressStreet,
  newAddressState,
  newAddressCity,
  setNewAddressStreet,
  setNewAddressState,
  setNewAddressCity,
  shippingStates,
  shippingCities,
  isLoadingLocations,
  setShippingQuotes,
  setSelectedQuoteId,
  setDeliveryMethod,
  isHydrated,
}: DeliveryAddressSectionProps) {
  // Manual State/City fallback so checkout can proceed even when Google Places
  // is unavailable (e.g. quota exhausted) or can't resolve the typed address.
  const [manualLocationOpen, setManualLocationOpen] = useState(false);
  const [placesFailed, setPlacesFailed] = useState(false);

  const hasDetectedLocation = Boolean(newAddressState && newAddressCity);
  const manualLocationInUse = manualLocationOpen || placesFailed;
  const showManualLocation =
    manualLocationOpen || (placesFailed && !hasDetectedLocation);
  const showManualToggle = !showManualLocation && !hasDetectedLocation;

  return (
    <div className="space-y-4">
      {user && addresses.length > 0 && (
        <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
          <legend className="sr-only">Where should we deliver?</legend>
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Where should we deliver?
            </p>
            <button
              type="button"
              onClick={() => setIsNewAddressMode(!isNewAddressMode)}
              className="text-xs font-bold text-store-primary hover:underline"
            >
              {isNewAddressMode ? 'Select Saved Address' : '+ New Address'}
            </button>
          </div>
          {!isNewAddressMode &&
            addresses.map((addr) => (
              <label
                key={addr.id}
                className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
                  selectedAddressId === addr.id
                    ? 'border-store-primary bg-store-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="address"
                  checked={selectedAddressId === addr.id}
                  onChange={() => {
                    setSelectedAddressId(addr.id);
                    setIsNewAddressMode(false);
                    const parts = addr.address.split(',').map((s) => s.trim());
                    if (parts.length >= 2) {
                      setNewAddressState(parts[parts.length - 1] || '');
                      setNewAddressCity(parts[parts.length - 2] || '');
                    }
                  }}
                  className="mt-1 size-4 text-store-primary focus:ring-store-primary border-gray-300"
                />
                <div className="ml-3">
                  <p className="font-bold text-gray-900 text-sm">
                    {addr.label || 'Saved Address'}
                  </p>
                  <p className="text-gray-600 text-sm mt-0.5">{addr.address}</p>
                  <p className="text-gray-500 text-xs mt-1">{addr.phone}</p>
                </div>
              </label>
            ))}
        </fieldset>
      )}

      {(isNewAddressMode || !user || addresses.length === 0) && (
        <div className="space-y-4" style={{ overflow: 'visible' }}>
          <label
            htmlFor="checkout-street-address"
            className="block text-xs font-bold text-gray-700 uppercase tracking-wide"
          >
            {user && addresses.length > 0
              ? 'Enter New Address'
              : 'Delivery Address'}
          </label>
          <AddressAutocomplete
            id="checkout-street-address"
            value={newAddressStreet}
            useThemedInput={true}
            onChange={(val) => {
              const newVal = typeof val === 'string' ? val : val.target.value;
              setNewAddressStreet(newVal);

              if (!newVal || newVal.length < 10) {
                if (!manualLocationInUse) {
                  setNewAddressState('');
                  setNewAddressCity('');
                  setShippingQuotes([]);
                  setSelectedQuoteId('');
                  setDeliveryMethod('door');
                }
                if (!newVal) setManualLocationOpen(false);
                return;
              }

              const inferred = inferAddressLocationFromInput(
                newVal,
                shippingStates,
              );
              if (inferred) {
                setNewAddressState(inferred.state);
                setNewAddressCity(inferred.city);
              } else if (!manualLocationInUse) {
                setNewAddressState('');
                setNewAddressCity('');
                setShippingQuotes([]);
                setSelectedQuoteId('');
                setDeliveryMethod('door');
              }
            }}
            onSelect={(place) => {
              setNewAddressStreet(place.formattedAddress);
              setNewAddressState(place.state);
              setNewAddressCity(place.city);
              setPlacesFailed(false);
              setManualLocationOpen(false);
            }}
            onError={(failed) => setPlacesFailed(failed)}
            placeholder="Start typing your address..."
            country="NG"
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus-visible:ring-0 focus:border-store-primary text-sm text-gray-900 placeholder:text-gray-400"
          />
          {isHydrated && hasDetectedLocation && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check size={12} /> Detected: {newAddressCity}, {newAddressState}
            </p>
          )}

          {isHydrated && showManualToggle && (
            <button
              type="button"
              onClick={() => setManualLocationOpen(true)}
              className="text-xs font-medium text-store-primary hover:underline text-left"
            >
              Can&apos;t find your address? Enter State &amp; City manually
            </button>
          )}

          {isHydrated && showManualLocation && (
            <div className="space-y-3">
              {placesFailed && (
                <p className="text-xs text-amber-600">
                  Address suggestions are unavailable right now — enter your State
                  and City to continue.
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="checkout-manual-state"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wide"
                  >
                    State
                  </label>
                  <select
                    id="checkout-manual-state"
                    value={newAddressState}
                    disabled={isLoadingLocations}
                    onChange={(e) => {
                      setManualLocationOpen(true);
                      setNewAddressState(e.target.value);
                      setShippingQuotes([]);
                      setSelectedQuoteId('');
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:border-store-primary text-sm text-gray-900 disabled:opacity-50"
                  >
                    <option value="">
                      {isLoadingLocations ? 'Loading states…' : 'Select state'}
                    </option>
                    {shippingStates.map((stateOption) => (
                      <option key={stateOption} value={stateOption}>
                        {stateOption}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="checkout-manual-city"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wide"
                  >
                    City / Area
                  </label>
                  <input
                    id="checkout-manual-city"
                    type="text"
                    value={newAddressCity}
                    list="checkout-manual-city-options"
                    onChange={(e) => {
                      setManualLocationOpen(true);
                      setNewAddressCity(e.target.value);
                    }}
                    placeholder="e.g. Lekki"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:border-store-primary text-sm text-gray-900 placeholder:text-gray-400"
                  />
                  {shippingCities.length > 0 && (
                    <datalist id="checkout-manual-city-options">
                      {shippingCities.map((cityOption) => (
                        <option key={cityOption} value={cityOption} />
                      ))}
                    </datalist>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
