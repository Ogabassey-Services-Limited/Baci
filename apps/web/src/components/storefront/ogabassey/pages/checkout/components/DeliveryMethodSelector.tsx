'use client';

import { Building2, Plane, Truck } from 'lucide-react';
import { isAirportDeliveryEligible, isPickupEligible } from '@baci/shared';
import type { DeliveryMethod } from '../types';

interface DeliveryMethodSelectorProps {
  isHydrated: boolean;
  newAddressState: string;
  newAddressCity: string;
  isNewAddressMode: boolean;
  selectedAddressId: number;
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (value: DeliveryMethod) => void;
}

function getDeliveryMethodCopy(method: DeliveryMethod) {
  if (method === 'door') {
    return { Icon: Truck, label: 'Door Delivery', subtitle: 'To your address' };
  }
  if (method === 'pickup') {
    return { Icon: Building2, label: 'Pickup', subtitle: 'Collect at store' };
  }
  return { Icon: Plane, label: 'Airport', subtitle: 'Via air cargo' };
}

export function DeliveryMethodSelector({
  isHydrated,
  newAddressState,
  newAddressCity,
  isNewAddressMode,
  selectedAddressId,
  deliveryMethod,
  setDeliveryMethod,
}: DeliveryMethodSelectorProps) {
  const canChooseDeliveryMethod =
    isHydrated &&
    ((newAddressState && newAddressCity) || (!isNewAddressMode && selectedAddressId));

  if (!canChooseDeliveryMethod) return null;

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="sr-only">How would you like to receive your order?</legend>
      <div className="mt-6 border-t border-store-background-text/10 pt-4">
        <p className="mb-3 block text-xs font-bold uppercase tracking-wide text-store-background-text/70">
          How would you like to receive your order?
        </p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {(['door', 'pickup', 'airport'] as const).map((method) => {
            if (method === 'pickup' && !isPickupEligible(newAddressState)) {
              return null;
            }
            if (
              method === 'airport' &&
              !isAirportDeliveryEligible(newAddressState)
            ) {
              return null;
            }

            const { Icon, label, subtitle } = getDeliveryMethodCopy(method);

            return (
              <label
                key={method}
                className={`flex-1 flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all gap-1 min-w-[100px] cursor-pointer focus-within:ring-2 focus-within:ring-store-primary focus-within:ring-offset-2 ${
                  deliveryMethod === method
                    ? 'border-store-primary bg-store-primary/5 text-store-primary'
                    : 'border-store-background-text/10 bg-store-background text-store-background-text/55 hover:border-store-background-text/20 hover:bg-store-primary/5'
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
                <Icon
                  className={`w-6 h-6 ${
                    deliveryMethod === method
                      ? 'text-store-primary'
                      : 'text-store-background-text/40'
                  }`}
                />
                <span className="text-xs sm:text-sm font-bold">{label}</span>
                <span className="text-[10px] text-store-background-text/45">
                  {subtitle}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}
