'use client';

import { Check, ChevronRight, Star } from 'lucide-react';
import { useState } from 'react';
import type { ImeiServiceTierKey } from '@baci/shared/imei';
import { getDisplayTier } from './imei-checker-tiers';

interface ImeiCheckerTierSelectorProps {
  canToggleServices: boolean;
  displayedTierKeys: readonly ImeiServiceTierKey[];
  selectedTier: ImeiServiceTierKey;
  showAllServices: boolean;
  onSelectTier: (tier: ImeiServiceTierKey) => void;
  onToggleServices: () => void;
}

/**
 * Tier grid driven by the caller's already-filtered displayedTierKeys (device
 * + brand + expand/collapse), replacing the old hardcoded 4-key picker.
 * Includes the collapse/expand toggle and a "what's included" disclosure.
 */
export function ImeiCheckerTierSelector({
  canToggleServices,
  displayedTierKeys,
  selectedTier,
  showAllServices,
  onSelectTier,
  onToggleServices,
}: ImeiCheckerTierSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);
  const currentTier = getDisplayTier(selectedTier);
  const detailsId = 'imei-tier-details';

  return (
    <div>
      <div
        aria-label="Service tier"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
        role="radiogroup"
      >
        {displayedTierKeys.map((tierKey) => {
          const tier = getDisplayTier(tierKey);
          const isSelected = tierKey === selectedTier;
          const Icon = tier.icon;

          return (
            <button
              aria-checked={isSelected}
              aria-label={`${tier.name}, ${tier.tagline}, ${tier.priceDisplay}`}
              className={`relative rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-[var(--store-primary)] bg-[var(--store-primary)]/5 shadow-lg shadow-[var(--store-primary)]/20'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-md'
              }`}
              key={tierKey}
              onClick={() => onSelectTier(tierKey)}
              role="radio"
              type="button"
            >
              {tier.recommended && (
                <div className="-right-2 -top-2 absolute flex items-center gap-1 rounded-full bg-[var(--store-primary)] px-2 py-0.5 text-[10px] font-bold text-[var(--store-primary-text,#ffffff)]">
                  <Star fill="currentColor" size={10} />
                  BEST
                </div>
              )}
              <Icon
                className={
                  isSelected ? 'text-[var(--store-primary)]' : 'text-gray-400'
                }
                size={24}
              />
              <p
                className={`mt-2 text-sm font-bold ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}
              >
                {tier.name}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{tier.tagline}</p>
              <p
                className={`mt-2 text-sm font-bold ${isSelected ? 'text-[var(--store-primary)]' : 'text-gray-900'}`}
              >
                {tier.priceDisplay}
              </p>
            </button>
          );
        })}
      </div>

      {canToggleServices && (
        <div className="mt-3 text-center">
          <button
            className="text-sm text-gray-500 hover:text-gray-700"
            onClick={onToggleServices}
            type="button"
          >
            {showAllServices ? 'Show key checks' : 'Show all services'}
          </button>
        </div>
      )}

      <div className="mt-4 text-center">
        <button
          aria-controls={detailsId}
          aria-expanded={showDetails}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          onClick={() => setShowDetails((value) => !value)}
          type="button"
        >
          What's included in {currentTier.name}?
          <ChevronRight
            className={`transition-transform ${showDetails ? 'rotate-90' : ''}`}
            size={14}
          />
        </button>
        {showDetails && (
          <div
            className="mt-3 inline-flex flex-wrap justify-center gap-2"
            id={detailsId}
          >
            {currentTier.features.map((feature) => (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700"
                key={feature}
              >
                <Check
                  className="text-[var(--store-success-text,#16a34a)]"
                  size={12}
                />
                {feature}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
