'use client';

import { Building2, Plane, Truck } from 'lucide-react';
import { SmartQuoteLoader } from '../../../components/SmartQuoteLoader';
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

function PickupDetails() {
  return (
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
  );
}

interface AirportOptionsProps {
  airportType: 'delivery' | 'pickup';
  setAirportType: (value: 'delivery' | 'pickup') => void;
}

function AirportOptions({ airportType, setAirportType }: AirportOptionsProps) {
  return (
    <div className="mt-4 space-y-3 animate-in fade-in">
      <div className="flex items-start gap-3">
        <Plane size={20} className="text-gray-500 mt-0.5" />
        <p className="text-sm text-gray-600">
          Delivery to your nearest airport. Choose delivery to your location or
          pickup at the airport.
        </p>
      </div>
      <fieldset className="m-0 grid min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-2">
        <legend className="sr-only">Airport delivery preference</legend>
        <AirportOption
          type="delivery"
          label="Airport Delivery"
          description="Delivered to your address"
          price="₦25,000"
          airportType={airportType}
          setAirportType={setAirportType}
        />
        <AirportOption
          type="pickup"
          label="Airport Pickup"
          description="Collect at the airport"
          price="₦20,000"
          airportType={airportType}
          setAirportType={setAirportType}
        />
      </fieldset>
    </div>
  );
}

interface AirportOptionProps extends AirportOptionsProps {
  type: 'delivery' | 'pickup';
  label: string;
  description: string;
  price: string;
}

function AirportOption({
  type,
  label,
  description,
  price,
  airportType,
  setAirportType,
}: AirportOptionProps) {
  const selected = airportType === type;

  return (
    <label
      className={`relative flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
        selected
          ? 'border-store-primary bg-store-primary/5'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
      }`}
    >
      <input
        type="radio"
        name="airportType"
        value={type}
        checked={selected}
        onChange={() => setAirportType(type)}
        className="sr-only"
      />
      <div
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-store-primary' : 'border-gray-400'
        }`}
      >
        {selected && <div className="size-2.5 rounded-full bg-store-primary" />}
      </div>
      <div className="flex-1">
        <p className="font-bold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <span className="font-bold text-gray-900">{price}</span>
    </label>
  );
}

function DoorDeliveryQuotes({
  shippingQuotes,
  isLoadingQuotes,
  selectedQuoteId,
  setSelectedQuoteId,
  fetchShippingQuotes,
  newAddressStreet,
  newAddressState,
  newAddressCity,
  customerPhone,
  firstName,
  lastName,
  customerEmail,
}: Omit<DeliveryMethodDetailsProps, 'deliveryMethod' | 'airportType' | 'setAirportType'>) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Select Delivery Option</legend>
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
                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-store-primary/60 transition-all ${
                  selectedQuoteId === quote.id
                    ? 'border-store-primary bg-store-primary/5 ring-1 ring-store-primary'
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
                      <span className="text-sm font-bold text-gray-900">
                        {quote.displayName}
                      </span>
                      {quote.carrierName.includes('GIG') && (
                        <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-bold">
                          GIGL
                        </span>
                      )}
                      {quote.carrierName.includes('Topship') && (
                        <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                          Best Value
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Est. Delivery:{' '}
                      {quote.deliveryRange || `${quote.estimatedDays} days`}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-sm text-gray-900">
                  ₦{quote.price.toLocaleString()}
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
                  customerEmail,
                );
              }
            }}
            className="w-full bg-linear-to-r from-amber-50 to-orange-50 border-2 border-dashed border-amber-300 rounded-xl p-5 flex flex-col items-center gap-3 hover:border-amber-400 hover:shadow-md transition-all group cursor-pointer"
          >
            <div className="size-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Truck size={24} />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-gray-900">
                Oops! Rates took a detour
              </h4>
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
  );
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
