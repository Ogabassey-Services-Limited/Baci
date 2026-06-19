import { Building2 } from 'lucide-react';
import { PICKUP_CONFIG } from '@/components/storefront/ogabassey/config/checkout/pickup-locations';

export function PickupDetails() {
  const { closingTime, location, name, readinessTime } = PICKUP_CONFIG.mainOffice;

  return (
    <div className="mt-4 bg-store-background p-4 rounded-xl border border-store-background-text/10 flex items-start gap-4 animate-in fade-in">
      <div className="bg-store-background p-2 rounded-lg border border-store-background-text/10">
        <Building2 size={24} className="text-store-background-text/60" />
      </div>
      <div>
        <h4 className="font-bold text-store-background-text text-sm">
          {name}
        </h4>
        <p className="text-sm text-store-background-text/60 mt-1">
          Available for pickup at our {location}. Usually ready within {readinessTime}.
        </p>
        <div className="mt-2 text-xs font-mono bg-store-background inline-block px-2 py-1 rounded border border-store-background-text/10 text-store-background-text/55">
          Pickup closes at {closingTime}
        </div>
      </div>
    </div>
  );
}
