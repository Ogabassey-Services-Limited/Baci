'use client';

import { Truck } from 'lucide-react';
import { getCarrierBadge } from '@/config/shipping-carriers';
import { SmartQuoteLoader } from '../../../components/SmartQuoteLoader';
import type { ShippingQuote } from '../types';

interface DoorDeliveryQuotesProps {
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

export function DoorDeliveryQuotes({
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
}: DoorDeliveryQuotesProps) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">Select Delivery Option</legend>
      <div className="mt-6 border-t border-store-background-text/10 pt-4">
        <p className="mb-3 block text-xs font-bold uppercase tracking-wide text-store-background-text/70">
          Select Delivery Option
        </p>

        {isLoadingQuotes ? (
          <SmartQuoteLoader />
        ) : shippingQuotes.length > 0 ? (
          <div className="space-y-3">
            {shippingQuotes.map((quote) => {
              const carrierBadge = getCarrierBadge(quote.carrierName);

              return (
                <label
                  key={quote.id}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:border-store-primary/60 transition-all ${
                    selectedQuoteId === quote.id
                      ? 'border-store-primary bg-store-primary/5 ring-1 ring-store-primary'
                      : 'border-store-background-text/10 bg-store-background'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping_quote"
                      checked={selectedQuoteId === quote.id}
                      onChange={() => setSelectedQuoteId(quote.id)}
                      className="size-4 border-store-background-text/25 text-store-primary focus:ring-store-primary"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-store-background-text">
                          {quote.displayName}
                        </span>
                        {carrierBadge && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${carrierBadge.className}`}
                          >
                            {carrierBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-store-background-text/55">
                        Est. Delivery:{' '}
                        {quote.deliveryRange || `${quote.estimatedDays} days`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-store-background-text">
                    ₦{quote.price.toLocaleString()}
                  </span>
                </label>
              );
            })}
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
            className="group flex w-full cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-store-primary/25 bg-store-primary/5 p-5 transition-all hover:border-store-primary/50 hover:shadow-md"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-store-primary/10 text-store-primary transition-transform group-hover:scale-110">
              <Truck size={24} />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-bold text-store-background-text">
                Oops! Rates took a detour
              </h4>
              <p className="mt-1 text-xs text-store-background-text/65">
                Our delivery partners are a bit slow today. Tap here to try again!
              </p>
            </div>
            <span className="rounded-full bg-store-primary/10 px-3 py-1 text-xs font-bold text-store-primary transition-colors group-hover:bg-store-primary/15">
              Refresh Rates
            </span>
          </button>
        )}
      </div>
    </fieldset>
  );
}
