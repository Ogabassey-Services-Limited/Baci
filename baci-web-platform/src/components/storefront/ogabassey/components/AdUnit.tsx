// Migrated from temp-source/components/AdUnit.tsx
'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AD_CONFIG } from '../config/ads';

interface AdUnitProps {
  placementKey: keyof typeof AD_CONFIG;
  className?: string;
  refreshKey?: string | number;
}

// TODO: REPLACE WITH YOUR ACTUAL GOOGLE AD MANAGER NETWORK CODE
const NETWORK_CODE = '/23331099951'; // Updated from screenshot

// Track defined slots globally to prevent duplicates in React StrictMode
const definedSlots = new Set<string>();

export const AdUnit: React.FC<AdUnitProps> = ({
  placementKey,
  className = '',
  refreshKey,
}) => {
  const config = AD_CONFIG[placementKey];
  const adRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<googletag.Slot | null>(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);

  useEffect(() => {
    if (!config) return;

    const { id, width, height, mobileWidth, mobileHeight } = config;
    const slotPath = `${NETWORK_CODE}/${config.name.replace(/\s+/g, '_')}`; // Construct ad unit path

    // Skip if this slot is already defined (React StrictMode double-render protection)
    if (definedSlots.has(id)) {
      return;
    }

    // Ensure googletag is loaded
    window.googletag = window.googletag || { cmd: [] };

    window.googletag.cmd.push(() => {
      // Double-check inside the queue in case of race conditions
      if (definedSlots.has(id)) {
        return;
      }

      // Define the slot
      // We implement basic size mapping for responsiveness if mobile dims exist
      let slot;

      if (mobileWidth && mobileHeight) {
        const mapping = window.googletag.sizeMapping()
          .addSize([768, 0], [width, height]) // Desktop
          .addSize([0, 0], [mobileWidth, mobileHeight]) // Mobile
          .build();

        slot = window.googletag.defineSlot(slotPath, [width, height], id)
          ?.defineSizeMapping(mapping)
          .addService(window.googletag.pubads());
      } else {
        slot = window.googletag.defineSlot(slotPath, [width, height], id)
          ?.addService(window.googletag.pubads());
      }

      if (slot) {
        // Track this slot as defined
        definedSlots.add(id);
        slotRef.current = slot;

        window.googletag.display(id);

        // Listen for render events to hide placeholder if needed
        window.googletag.pubads().addEventListener('slotRenderEnded', (event: any) => {
          if (event.slot === slot) {
            setIsAdLoaded(!event.isEmpty);
          }
        });
      }
    });

    return () => {
      // Cleanup: Destroy slot to prevent memory leaks in SPA navigation
      const slotToDestroy = slotRef.current;
      const slotId = id;
      if (slotToDestroy) {
        window.googletag.cmd.push(() => {
          window.googletag.destroySlots([slotToDestroy]);
          definedSlots.delete(slotId);
          slotRef.current = null;
        });
      }
    };
  }, [config, placementKey]);

  // Effect to handle manual refresh triggers
  useEffect(() => {
    if (!config || !window.googletag?.pubads) return;

    // Check if we have a refresh trigger and a valid slot
    const slot = slotRef.current;

    if (refreshKey && slot) {
      window.googletag.cmd.push(() => {
        window.googletag.pubads().refresh([slot]);
      });
    }
  }, [refreshKey, config]);



  if (!config) return null;

  return (
    <div className={`w-full flex justify-center items-center my-6 ${className}`}>
      <div className="flex flex-col items-center">
        <span className="text-[9px] text-gray-300 uppercase tracking-widest mb-1 self-start ml-1">
          Sponsored
        </span>

        {/* 
          --- AD CONTAINER ---
          Preserving CLS protection with fixed dimensions.
        */}
        <div
          className="relative overflow-hidden bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center shadow-sm"
          style={{
            minHeight: `${config.mobileHeight || config.height}px`, // Start with mobile height min
            minWidth: `${config.mobileWidth || config.width}px`,
          }}
        >
          {/* THE ACTUAL GOOGLE AD SLOT */}
          <div id={config.id} ref={adRef} className="z-10" />

          {/* Placeholder Pattern (Visible only until ad loads) */}
          {!isAdLoaded && (
            <div
              className="absolute inset-0 w-full h-full flex flex-col items-center justify-center p-4 -z-0 opacity-50"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent 10px)'
              }}
            >
              <span className="text-xs font-bold text-gray-300 uppercase tracking-widest mb-1">
                Ad Space
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                {config.name}
              </span>
              <span className="text-[9px] text-gray-300 mt-1">
                {config.width}x{config.height}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
