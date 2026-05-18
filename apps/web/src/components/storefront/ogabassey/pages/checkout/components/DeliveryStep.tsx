'use client';

import { Check, ChevronRight, Plane, Truck, Building2 } from 'lucide-react';
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
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                        Where should we deliver?
                      </label>
                      <button
                        onClick={() => setIsNewAddressMode(!isNewAddressMode)}
                        className="text-xs font-bold text-store-primary hover:underline"
                      >
                        {isNewAddressMode ? 'Select Saved Address' : '+ New Address'}
                      </button>
                    </div>
                    {!isNewAddressMode && addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start p-4 rounded-xl border cursor-pointer transition-all ${selectedAddressId === addr.id
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
                          className="mt-1 w-4 h-4 text-store-primary focus:ring-store-primary border-gray-300"
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
                  </div>
                )}

                {/* New Address Form */}
                {(isNewAddressMode || !user || addresses.length === 0) && (
                  <div className="space-y-4" style={{ overflow: 'visible' }}>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">
                      {user && addresses.length > 0 ? 'Enter New Address' : 'Delivery Address'}
                    </label>
                    <AddressAutocomplete
                      value={newAddressStreet}
                      useThemedInput={true}
                      onChange={(val) => {
                        const newVal = typeof val === 'string' ? val : val.target.value;
                        setNewAddressStreet(newVal);

                        // Reset state/city if address is cleared or changed significantly
                        if (!newVal || newVal.length < 10) {
                          setNewAddressState('');
                          setNewAddressCity('');
                          setShippingQuotes([]);
                          setSelectedQuoteId('');
                          setDeliveryMethod('door'); // Reset to default
                          return;
                        }

                        const inferred = inferAddressLocationFromInput(
                          newVal,
                          shippingStates,
                        );
                        if (inferred) {
                          setNewAddressState(inferred.state);
                          setNewAddressCity(inferred.city);
                        } else {
                          setNewAddressState('');
                          setNewAddressCity('');
                          setShippingQuotes([]);
                          setSelectedQuoteId('');
                          setDeliveryMethod('door');
                        }
                      }}
                      onSelect={(place: any) => {
                        setNewAddressStreet(place.formattedAddress);
                        if (place.state) {
                          setNewAddressState(place.state);
                        }
                        if (place.city) {
                          setNewAddressCity(place.city);
                        }
                      }}
                      placeholder="Start typing your address..."
                      country="NG"
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-hidden focus-visible:ring-0 focus:border-red-500 text-sm text-gray-900 placeholder:text-gray-400"
                    />
                    {isHydrated && newAddressState && newAddressCity && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <Check size={12} /> Detected: {newAddressCity}, {newAddressState}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: Delivery Method Cards - ONLY show AFTER address is detected */}
              {isHydrated && ((newAddressState && newAddressCity) || (!isNewAddressMode && selectedAddressId)) && (
                <>
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                      How would you like to receive your order?
                    </label>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {(['door', 'pickup', 'airport'] as const).map((method) => {
                        // Filter out Pickup if not in Lagos (store is in Lagos)
                        if (method === 'pickup') {
                          const currentState = newAddressState;
                          const isLagos = currentState && currentState.toLowerCase() === 'lagos';
                          if (!isLagos) return null;
                        }

                        // Filter out Airport if not eligible (non-Lagos states only)
                        if (method === 'airport') {
                          const AIRPORT_STATES = [
                            'Abuja', 'FCT', 'Federal Capital Territory', 'FCT - Abuja',
                            'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
                            'Borno', 'Cross River', 'Delta', 'Edo', 'Enugu', 'Gombe',
                            'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
                            'Kwara', 'Niger', 'Ondo', 'Oyo', 'Plateau', 'Rivers',
                            'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
                          ];
                          const currentState = newAddressState;
                          const isEligible = currentState && AIRPORT_STATES.some(s => s.toLowerCase() === currentState.toLowerCase()) && currentState.toLowerCase() !== 'lagos';
                          if (!isEligible) return null;
                        }

                        const Icon = method === 'door' ? Truck : method === 'pickup' ? Building2 : Plane;
                        const label = method === 'door' ? 'Door Delivery' : method === 'pickup' ? 'Pickup' : 'Airport';
                        const subtitle = method === 'door' ? 'To your address' : method === 'pickup' ? 'Collect at store' : 'Via air cargo';

                        return (
                          <button
                            key={method}
                            onClick={() => setDeliveryMethod(method)}
                            className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-1 min-w-[100px] ${deliveryMethod === method
                              ? 'border-store-primary bg-store-primary/5 text-store-primary'
                              : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            <Icon className={`w-6 h-6 ${deliveryMethod === method ? 'text-store-primary' : 'text-gray-400'}`} />
                            <span className="text-xs sm:text-sm font-bold">{label}</span>
                            <span className="text-[10px] text-gray-400">{subtitle}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'delivery'
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
                              <div className="w-2.5 h-2.5 rounded-full bg-store-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">Airport Delivery</p>
                            <p className="text-xs text-gray-500 mt-0.5">Delivered to your address</p>
                          </div>
                          <span className="font-bold text-gray-900">&#8358;25,000</span>
                        </label>
                        <label
                          className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${airportType === 'pickup'
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
                              <div className="w-2.5 h-2.5 rounded-full bg-store-primary" />
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-gray-900 text-sm">Airport Pickup</p>
                            <p className="text-xs text-gray-500 mt-0.5">Collect at the airport</p>
                          </div>
                          <span className="font-bold text-gray-900">&#8358;20,000</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Door Delivery - Quote Selector */}
                  {deliveryMethod === 'door' && (
                    <div className="mt-6 border-t border-gray-100 pt-4">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">
                        Select Delivery Option
                      </label>

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
                                  className="w-4 h-4 text-store-primary focus:ring-store-primary border-gray-300"
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
                          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
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
