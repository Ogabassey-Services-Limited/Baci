'use client';

import { useState } from 'react';
import { Check, ChevronRight, Plane, Truck, Building2 } from 'lucide-react';
import {
  isAirportDeliveryEligible,
  isPickupEligible,
} from '@baci/shared';
import { AddressAutocomplete } from '@/components/address-autocomplete';
import { SmartQuoteLoader } from '../../../components/SmartQuoteLoader';
import type { SavedAddress, ShippingQuote } from '../types';
import { inferAddressLocationFromInput } from '../utils';

type StepName = 'contact' | 'delivery' | 'payment';

interface CompletedSteps {
  contact: boolean;
  delivery: boolean;
}

interface DeliveryStepProps {
  currentStep: StepName;
  completedSteps: CompletedSteps;
  deliveryMethod: 'pickup' | 'door' | 'airport';
  setDeliveryMethod: (v: 'pickup' | 'door' | 'airport') => void;
  airportType: 'delivery' | 'pickup';
  setAirportType: (v: 'delivery' | 'pickup') => void;
  isNewAddressMode: boolean;
  setIsNewAddressMode: (v: boolean) => void;
  newAddressStreet: string;
  newAddressState: string;
  newAddressCity: string;
  setNewAddressStreet: (v: string) => void;
  setNewAddressState: (v: string) => void;
  setNewAddressCity: (v: string) => void;
  selectedAddressId: number;
  setSelectedAddressId: (v: number) => void;
  addresses: SavedAddress[];
  shippingStates: string[];
  shippingCities: string[];
  isLoadingLocations: boolean;
  shippingQuotes: ShippingQuote[];
  setShippingQuotes: (v: ShippingQuote[]) => void;
  isLoadingQuotes: boolean;
  selectedQuoteId: string;
  setSelectedQuoteId: (v: string) => void;
  fetchShippingQuotes: (
    address: string,
    state: string,
    city: string,
    phone: string,
    fName: string,
    lName: string,
    email: string,
  ) => void;
  isDeliveryValid: boolean;
  setCurrentStep: (step: StepName) => void;
  setCompletedSteps: (
    value:
      | CompletedSteps
      | ((prev: CompletedSteps) => CompletedSteps),
  ) => void;
  user: { id: string } | null | undefined;
  isHydrated: boolean;
  customerPhone: string;
  firstName: string;
  lastName: string;
  customerEmail: string;
}

export function DeliveryStep({
  currentStep,
  completedSteps,
  deliveryMethod,
  setDeliveryMethod,
  airportType,
  setAirportType,
  isNewAddressMode,
  setIsNewAddressMode,
  newAddressStreet,
  newAddressState,
  newAddressCity,
  setNewAddressStreet,
  setNewAddressState,
  setNewAddressCity,
  selectedAddressId,
  setSelectedAddressId,
  addresses,
  shippingStates,
  shippingCities,
  isLoadingLocations,
  shippingQuotes,
  setShippingQuotes,
  isLoadingQuotes,
  selectedQuoteId,
  setSelectedQuoteId,
  fetchShippingQuotes,
  isDeliveryValid,
  setCurrentStep,
  setCompletedSteps,
  user,
  isHydrated,
  customerPhone,
  firstName,
  lastName,
  customerEmail,
}: DeliveryStepProps) {
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
    <>
      {/* Step 2: Delivery Method */}
      <div className={`bg-white rounded-2xl shadow-sm border ${currentStep === 'delivery' ? 'border-store-primary ring-1 ring-store-primary/20' : 'border-gray-100'} transition-all duration-300`}>
        <button
          type="button"
          onClick={() => completedSteps.contact && setCurrentStep('delivery')}
          disabled={!completedSteps.contact}
          className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
        >
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${completedSteps.delivery ? 'bg-green-100 text-green-600' : currentStep === 'delivery' ? 'bg-store-primary/10 text-store-primary' : 'bg-gray-100 text-gray-500'
              }`}>
              {completedSteps.delivery ? <Check size={14} /> : '2'}
            </div>
            Delivery Method
          </h2>
          {completedSteps.delivery && currentStep !== 'delivery' && (
            <span className="text-sm font-medium text-store-primary hover:text-store-primary">Edit</span>
          )}
        </button>

        <div className={`grid transition-all duration-300 ease-in-out ${currentStep === 'delivery' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
          <div className={currentStep === 'delivery' ? 'overflow-visible' : 'overflow-hidden'}>
            <div className="p-6 pt-0 space-y-4">
              {/* STEP 1: Address Input FIRST */}
              <div className="space-y-4">
                {/* Saved Addresses (for logged in users) */}
                {user && addresses.length > 0 && (
                  <fieldset className="m-0 min-w-0 space-y-3 border-0 p-0">
                    <legend className="sr-only">Where should we deliver?</legend>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Where should we deliver?
                      </p>
                      <button type="button"
                        onClick={() => setIsNewAddressMode(!isNewAddressMode)}
                        className="text-xs font-bold text-store-primary hover:underline"
                      >
                        {isNewAddressMode ? 'Select Saved Address' : '+ New Address'}
                      </button>
                    </div>
                    {!isNewAddressMode && addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${selectedAddressId === addr.id
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
                            // Extract state from saved address for eligibility checks
                            const parts = addr.address.split(',').map(s => s.trim());
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
                          <p className="text-gray-600 text-sm mt-0.5">
                            {addr.address}
                          </p>
                          <p className="text-gray-500 text-xs mt-1">
                            {addr.phone}
                          </p>
                        </div>
                      </label>
                    ))}
                  </fieldset>
                )}

                {/* New Address Form */}
                {(isNewAddressMode || !user || addresses.length === 0) && (
                  <div className="space-y-4" style={{ overflow: 'visible' }}>
                    <label htmlFor="checkout-street-address" className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      {user && addresses.length > 0 ? 'Enter New Address' : 'Delivery Address'}
                    </label>
                    <AddressAutocomplete
                      id="checkout-street-address"
                      value={newAddressStreet}
                      useThemedInput={true}
                      onChange={(val) => {
                        const newVal = typeof val === 'string' ? val : val.target.value;
                        setNewAddressStreet(newVal);

                        // Reset state/city if address is cleared or changed
                        // significantly — but never clobber a location the
                        // shopper is entering manually.
                        if (!newVal || newVal.length < 10) {
                          if (!manualLocationInUse) {
                            setNewAddressState('');
                            setNewAddressCity('');
                            setShippingQuotes([]);
                            setSelectedQuoteId('');
                            setDeliveryMethod('door'); // Reset to default
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
                        if (place.state) {
                          setNewAddressState(place.state);
                        }
                        if (place.city) {
                          setNewAddressCity(place.city);
                        }
                        // Places resolved the address — no fallback needed.
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
                            Address suggestions are unavailable right now — enter
                            your State and City to continue.
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
                                {isLoadingLocations
                                  ? 'Loading states…'
                                  : 'Select state'}
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

              {/* STEP 2: Delivery Method Cards - ONLY show AFTER address is detected */}
              {isHydrated && ((newAddressState && newAddressCity) || (!isNewAddressMode && selectedAddressId)) && (
                <>
                  <fieldset className="m-0 min-w-0 border-0 p-0">
                    <legend className="sr-only">
                      How would you like to receive your order?
                    </legend>
                    <div className="mt-6 border-t border-gray-100 pt-4">
                      <p className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                        How would you like to receive your order?
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-1">
                      {(['door', 'pickup', 'airport'] as const).map((method) => {
                        // Store ships from Lagos: pickup is Lagos-only and
                        // airport is for non-Lagos states with an airport.
                        // Shared with the mobile storefront so they can't drift.
                        if (method === 'pickup' && !isPickupEligible(newAddressState)) {
                          return null;
                        }
                        if (
                          method === 'airport' &&
                          !isAirportDeliveryEligible(newAddressState)
                        ) {
                          return null;
                        }

                        const Icon = method === 'door' ? Truck : method === 'pickup' ? Building2 : Plane;
                        const label = method === 'door' ? 'Door Delivery' : method === 'pickup' ? 'Pickup' : 'Airport';
                        const subtitle = method === 'door' ? 'To your address' : method === 'pickup' ? 'Collect at store' : 'Via air cargo';

                        return (
                          <label
                            key={method}
                            className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-1 min-w-[100px] cursor-pointer focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${deliveryMethod === method
                              ? 'border-store-primary bg-store-primary/5 text-store-primary'
                              : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            <input
                              type="radio"
                              name="deliveryMethod"
                              value={method}
                              checked={deliveryMethod === method}
                              onChange={() => setDeliveryMethod(method)}
                              className="sr-only"
                            />
                            <Icon className={`w-6 h-6 ${deliveryMethod === method ? 'text-store-primary' : 'text-gray-400'}`} />
                            <span className="text-xs sm:text-sm font-bold">{label}</span>
                            <span className="text-[10px] text-gray-400">{subtitle}</span>
                          </label>
                        );
                      })}
                      </div>
                    </div>
                  </fieldset>

                  {/* STEP 3: Delivery Method Details */}
                  {/* Pickup Info */}
                  {deliveryMethod === 'pickup' && (
                    <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-start gap-4 animate-in fade-in">
                      <div className="bg-white p-2 rounded-lg border border-gray-200">
                        <Building2 size={24} className="text-gray-600" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Main Office Pickup</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          Available for pickup at our Ikeja Store. Usually ready within 2 hours.
                        </p>
                        <div className="mt-2 text-xs font-mono bg-white inline-block px-2 py-1 rounded border border-gray-200 text-gray-500">
                          Pickup closes at 6 PM
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Airport Options */}
                  {deliveryMethod === 'airport' && (
                    <div className="mt-4 space-y-3 animate-in fade-in">
                      <div className="flex items-start gap-3">
                        <Plane size={20} className="text-gray-500 mt-0.5" />
                        <p className="text-sm text-gray-600">
                          Delivery to your nearest airport. Choose delivery to your location or pickup at the airport.
                        </p>
                      </div>
                      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
                        <legend className="sr-only">Airport delivery preference</legend>
                        <label
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${airportType === 'delivery'
                            ? 'border-store-primary bg-store-primary/5'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="airportType"
                            value="delivery"
                            checked={airportType === 'delivery'}
                            onChange={() => setAirportType('delivery')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'delivery' ? 'border-store-primary' : 'border-gray-400'
                            }`}>
                            {airportType === 'delivery' && (
                              <div className="size-2.5 rounded-full bg-store-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">Airport Delivery</p>
                            <p className="text-xs text-gray-500 mt-0.5">Delivered to your address</p>
                          </div>
                          <span className="font-bold text-gray-900">&#8358;25,000</span>
                        </label>
                        <label
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${airportType === 'pickup'
                            ? 'border-store-primary bg-store-primary/5'
                            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                            }`}
                        >
                          <input
                            type="radio"
                            name="airportType"
                            value="pickup"
                            checked={airportType === 'pickup'}
                            onChange={() => setAirportType('pickup')}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${airportType === 'pickup' ? 'border-store-primary' : 'border-gray-400'
                            }`}>
                            {airportType === 'pickup' && (
                              <div className="size-2.5 rounded-full bg-store-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">Airport Pickup</p>
                            <p className="text-xs text-gray-500 mt-0.5">Collect at the airport</p>
                          </div>
                          <span className="font-bold text-gray-900">&#8358;20,000</span>
                        </label>
                      </fieldset>
                    </div>
                  )}

                  {/* Door Delivery - Quote Selector */}
                  {deliveryMethod === 'door' && (
                    <fieldset className="m-0 min-w-0 border-0 p-0">
                      <legend className="sr-only">
                        Select Delivery Option
                      </legend>
                      <div className="mt-6 border-t border-gray-100 pt-4">
                        <p className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                          Select Delivery Option
                        </p>

                      {isLoadingQuotes ? (
                        <SmartQuoteLoader />
                      ) : shippingQuotes.length > 0 ? (
                        <div className="space-y-3">
                          {shippingQuotes.map((quote) => (
                            <label
                              key={quote.id}
                              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-store-primary/60 transition-all ${selectedQuoteId === quote.id
                                ? 'border-red-500 bg-store-primary/5 ring-1 ring-store-primary'
                                : 'border-gray-100 bg-white'
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="radio"
                                  name="shipping_quote"
                                  checked={selectedQuoteId === quote.id}
                                  onChange={() => setSelectedQuoteId(quote.id)}
                                  className="size-4 text-store-primary focus:ring-store-primary border-gray-300"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-gray-900">{quote.displayName}</span>
                                    {quote.carrierName.includes('GIG') && <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-bold">GIGL</span>}
                                    {quote.carrierName.includes('Topship') && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Best Value</span>}
                                  </div>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Est. Delivery: {(quote as any).deliveryRange || `${quote.estimatedDays} days`}
                                  </p>
                                </div>
                              </div>
                              <span className="font-bold text-sm text-gray-900">
                                &#8358;{quote.price.toLocaleString()}
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (newAddressState && newAddressCity) {
                              fetchShippingQuotes(
                                newAddressStreet || `${newAddressCity}, ${newAddressState}`,
                                newAddressState,
                                newAddressCity,
                                customerPhone,
                                firstName,
                                lastName,
                                customerEmail
                              );
                            }
                          }}
                          className="w-full bg-linear-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-amber-400 hover:shadow-md transition-all group cursor-pointer"
                        >
                          <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                            <Truck size={24} />
                          </div>
                          <div className="text-center">
                            <h4 className="text-sm font-bold text-gray-900">Oops! Rates took a detour</h4>
                            <p className="text-xs text-amber-700 mt-1">
                              Our delivery partners are a bit slow today. Tap here to try again!
                            </p>
                          </div>
                          <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-full group-hover:bg-amber-200 transition-colors">
                            Refresh Rates
                          </span>
                        </button>
                      )}
                      </div>
                    </fieldset>
                  )}
                </>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCompletedSteps(prev => ({ ...prev, delivery: true }));
                    setCurrentStep('payment');
                  }}
                  className="w-full md:w-auto px-6 py-3 bg-store-primary text-white font-bold rounded-xl hover:bg-store-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg hover:shadow-store-primary/20 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
                  disabled={!isDeliveryValid}
                >
                  Continue to Payment
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
