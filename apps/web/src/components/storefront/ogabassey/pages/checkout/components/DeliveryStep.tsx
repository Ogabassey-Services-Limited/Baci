'use client';

import { useEffect } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { isAirportDeliveryEligible, isPickupEligible } from '@baci/shared';
import { DeliveryAddressSection } from './DeliveryAddressSection';
import { DeliveryMethodDetails } from './DeliveryMethodDetails';
import { DeliveryMethodSelector } from './DeliveryMethodSelector';
import type { DeliveryMethod, SavedAddress, ShippingQuote } from '../types';
import { getStationPickupQuote } from '../utils';

type StepName = 'contact' | 'delivery' | 'payment';

interface CompletedSteps {
  contact: boolean;
  delivery: boolean;
}

interface DeliveryStepProps {
  currentStep: StepName;
  completedSteps: CompletedSteps;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (value: DeliveryMethod) => void;
  airportType: 'delivery' | 'pickup';
  setAirportType: (value: 'delivery' | 'pickup') => void;
  isNewAddressMode: boolean;
  setIsNewAddressMode: (value: boolean) => void;
  newAddressStreet: string;
  newAddressState: string;
  newAddressCity: string;
  setNewAddressStreet: (value: string) => void;
  setNewAddressState: (value: string) => void;
  setNewAddressCity: (value: string) => void;
  selectedAddressId: number;
  setSelectedAddressId: (value: number) => void;
  addresses: SavedAddress[];
  shippingStates: string[];
  shippingCities: string[];
  isLoadingLocations: boolean;
  shippingQuotes: ShippingQuote[];
  setShippingQuotes: (value: ShippingQuote[]) => void;
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
  isDeliveryValid: boolean;
  setCurrentStep: (step: StepName) => void;
  setCompletedSteps: (
    value: CompletedSteps | ((prev: CompletedSteps) => CompletedSteps),
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
  const canChooseDeliveryMethod = Boolean(
    isHydrated &&
      ((newAddressState && newAddressCity) ||
        (!isNewAddressMode && selectedAddressId)),
  );
  const stationPickupQuote = getStationPickupQuote(shippingQuotes);

  useEffect(() => {
    if (!canChooseDeliveryMethod) return;

    const isMethodEligible =
      deliveryMethod === 'door' ||
      (deliveryMethod === 'pickup_station' && Boolean(stationPickupQuote)) ||
      (deliveryMethod === 'pickup' && isPickupEligible(newAddressState)) ||
      (deliveryMethod === 'airport' &&
        isAirportDeliveryEligible(newAddressState));

    if (!isMethodEligible) {
      setDeliveryMethod('door');
    }
  }, [
    canChooseDeliveryMethod,
    deliveryMethod,
    newAddressState,
    setDeliveryMethod,
    stationPickupQuote,
  ]);

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${
        currentStep === 'delivery'
          ? 'border-store-primary ring-1 ring-store-primary/20'
          : 'border-gray-100'
      } transition-all duration-300`}
    >
      <button
        type="button"
        onClick={() => completedSteps.contact && setCurrentStep('delivery')}
        disabled={!completedSteps.contact}
        className="w-full px-6 py-4 flex items-center justify-between text-left disabled:opacity-50 disabled:cursor-not-allowed hidden-disabled"
      >
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors ${
              completedSteps.delivery
                ? 'bg-green-100 text-green-600'
                : currentStep === 'delivery'
                  ? 'bg-store-primary/10 text-store-primary'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            {completedSteps.delivery ? <Check size={14} /> : '2'}
          </div>
          Delivery Method
        </h2>
        {completedSteps.delivery && currentStep !== 'delivery' && (
          <span className="text-sm font-medium text-store-primary hover:text-store-primary">
            Edit
          </span>
        )}
      </button>

      <div
        className={`grid transition-all duration-300 ease-in-out ${
          currentStep === 'delivery'
            ? 'grid-rows-[1fr] opacity-100'
            : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div
          className={
            currentStep === 'delivery' ? 'overflow-visible' : 'overflow-hidden'
          }
        >
          <div className="p-6 pt-0 space-y-4">
            <DeliveryAddressSection
              user={user}
              addresses={addresses}
              isNewAddressMode={isNewAddressMode}
              setIsNewAddressMode={setIsNewAddressMode}
              selectedAddressId={selectedAddressId}
              setSelectedAddressId={setSelectedAddressId}
              newAddressStreet={newAddressStreet}
              newAddressState={newAddressState}
              newAddressCity={newAddressCity}
              setNewAddressStreet={setNewAddressStreet}
              setNewAddressState={setNewAddressState}
              setNewAddressCity={setNewAddressCity}
              shippingStates={shippingStates}
              shippingCities={shippingCities}
              isLoadingLocations={isLoadingLocations}
              setShippingQuotes={setShippingQuotes}
              setSelectedQuoteId={setSelectedQuoteId}
              setDeliveryMethod={setDeliveryMethod}
              isHydrated={isHydrated}
            />

            <DeliveryMethodSelector
              isHydrated={isHydrated}
              newAddressState={newAddressState}
              newAddressCity={newAddressCity}
              isNewAddressMode={isNewAddressMode}
              selectedAddressId={selectedAddressId}
              deliveryMethod={deliveryMethod}
              setDeliveryMethod={setDeliveryMethod}
              stationPickupQuote={stationPickupQuote}
            />

            {canChooseDeliveryMethod && (
              <DeliveryMethodDetails
                deliveryMethod={deliveryMethod}
                setDeliveryMethod={setDeliveryMethod}
                airportType={airportType}
                setAirportType={setAirportType}
                shippingQuotes={shippingQuotes}
                isLoadingQuotes={isLoadingQuotes}
                selectedQuoteId={selectedQuoteId}
                setSelectedQuoteId={setSelectedQuoteId}
                fetchShippingQuotes={fetchShippingQuotes}
                newAddressStreet={newAddressStreet}
                newAddressState={newAddressState}
                newAddressCity={newAddressCity}
                customerPhone={customerPhone}
                firstName={firstName}
                lastName={lastName}
                customerEmail={customerEmail}
              />
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setCompletedSteps((prev) => ({ ...prev, delivery: true }));
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
  );
}
