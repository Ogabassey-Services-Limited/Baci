import { Building2 } from 'lucide-react';

export function PickupDetails() {
  return (
    <div className="mt-4 bg-store-background p-4 rounded-xl border border-store-background-text/10 flex items-start gap-4 animate-in fade-in">
      <div className="bg-store-background p-2 rounded-lg border border-store-background-text/10">
        <Building2 size={24} className="text-store-background-text/60" />
      </div>
      <div>
        <h4 className="font-bold text-store-background-text text-sm">
          Main Office Pickup
        </h4>
        <p className="text-sm text-store-background-text/60 mt-1">
          Available for pickup at our Ikeja Store. Usually ready within 2 hours.
        </p>
        <div className="mt-2 text-xs font-mono bg-store-background inline-block px-2 py-1 rounded border border-store-background-text/10 text-store-background-text/55">
          Pickup closes at 6 PM
        </div>
      </div>
    </div>
  );
}
