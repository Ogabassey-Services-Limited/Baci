import { AlertTriangle, Monitor, Recycle, Smartphone } from 'lucide-react';

/**
 * Static "recycle responsibly" closing section of the Ogabassey Repair Lab
 * page. Extracted from repairs.tsx to keep that file under the modularity
 * line cap — purely presentational, no props.
 */
export function RepairsRecyclingSection() {
  return (
    <div className="bg-store-secondary rounded-3xl p-8 md:p-12 text-center border border-store-border">
      <div className="inline-flex items-center justify-center size-16 bg-store-background rounded-full mb-6 text-store-background-text shadow-sm">
        <Recycle size={32} />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-store-background-text mb-4">
        Beyond Repair? Recycle Responsibly.
      </h2>
      <p className="text-store-background-text/65 max-w-2xl mx-auto mb-8">
        If your device is truly at the end of its life, don't throw it in the
        trash. Electronic waste contains harmful chemicals. Drop it off at any
        Ogabassey location, and we will ensure it is stripped for parts and
        recycled safely.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="bg-store-background p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-store-border">
          <div className="bg-store-primary/5 text-store-primary p-2 rounded-lg">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="font-bold text-store-background-text text-sm">
              Safe Disposal
            </p>
            <p className="text-xs text-store-background-text/55">
              of Lithium Batteries
            </p>
          </div>
        </div>
        <div className="bg-store-background p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-store-border">
          <div className="bg-store-secondary text-store-secondary-text p-2 rounded-lg">
            <Monitor size={20} />
          </div>
          <div>
            <p className="font-bold text-store-background-text text-sm">
              Glass Recycling
            </p>
            <p className="text-xs text-store-background-text/55">
              Screens processed correctly
            </p>
          </div>
        </div>
        <div className="bg-store-background p-4 rounded-xl flex items-center gap-3 shadow-sm text-left border border-store-border">
          <div className="bg-store-accent/10 text-store-accent p-2 rounded-lg">
            <Smartphone size={20} />
          </div>
          <div>
            <p className="font-bold text-store-background-text text-sm">
              Component Harvest
            </p>
            <p className="text-xs text-store-background-text/55">
              Chips reused for repairs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
