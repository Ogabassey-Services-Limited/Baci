// Migrated from temp-source/components/AdUnit.tsx
'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AD_CONFIG } from '../config/ads';
import {
  ensureGoogleAdManagerBoot,
  ensureGoogleTag,
} from './google-ad-bootstrap';

interface AdUnitProps {
  placementKey: keyof typeof AD_CONFIG;
  className?: string;
  refreshKey?: string | number;
  isActive?: boolean;
  loadStrategy?: 'viewport' | 'immediate';
}

// TODO: REPLACE WITH YOUR ACTUAL GOOGLE AD MANAGER NETWORK CODE
const NETWORK_CODE = '/23331099951'; // Updated from screenshot

// Track defined slots globally to prevent duplicates in React StrictMode
const definedSlots = new Set<string>();

export const AdUnit: React.FC<AdUnitProps> = ({
  placementKey,
  className = '',
  refreshKey,
  isActive = true,
  loadStrategy = 'viewport',
}) => {
  const config = AD_CONFIG[placementKey];
  const containerRef = useRef<HTMLDivElement>(null);
  const adRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<googletag.Slot | null>(null);
  const [isAdLoaded, setIsAdLoaded] = useState(false);
  const [shouldLoadSlot, setShouldLoadSlot] = useState(
    loadStrategy === 'immediate'
  );

  useEffect(() => {
    setShouldLoadSlot(loadStrategy === 'immediate');
    setIsAdLoaded(false);
  }, [config?.id, loadStrategy]);

  useEffect(() => {
    if (!config || loadStrategy === 'immediate' || !isActive || shouldLoadSlot) {
      if (loadStrategy === 'immediate') {
        setShouldLoadSlot(true);
      }
      return;
    }

    const target = containerRef.current;

    if (!target || typeof IntersectionObserver === 'undefined') {
      setShouldLoadSlot(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some(
            (entry) => entry.isIntersecting || entry.intersectionRatio > 0
          )
        ) {
          setShouldLoadSlot(true);
          observer.disconnect();
        }
      },
      { rootMargin: '400px 0px' }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [config, isActive, loadStrategy, shouldLoadSlot]);

  useEffect(() => {
    if (!config || !shouldLoadSlot) return;

    const { id, width, height, mobileWidth, mobileHeight } = config;
    const slotPath = `${NETWORK_CODE}/${config.name.replace(/\s+/g, '_')}`; // Construct ad unit path
    let cancelled = false;

    // Skip if this slot is already defined (React StrictMode double-render protection)
    if (definedSlots.has(id)) {
      return;
    }

    void ensureGoogleAdManagerBoot()
      .then(() => {
        if (cancelled || definedSlots.has(id)) {
          return;
        }

        const googletag = ensureGoogleTag();

        googletag.cmd.push(() => {
          if (cancelled || definedSlots.has(id)) {
            return;
          }

          // Define the slot
          // We implement basic size mapping for responsiveness if mobile dims exist
          let slot;

          if (mobileWidth && mobileHeight) {
            const mapping = googletag.sizeMapping()
              .addSize([768, 0], [width, height]) // Desktop
              .addSize([0, 0], [mobileWidth, mobileHeight]) // Mobile
              .build();

            slot = googletag
              .defineSlot(slotPath, [width, height], id)
              ?.defineSizeMapping(mapping)
              .addService(googletag.pubads());
          } else {
            slot = googletag
              .defineSlot(slotPath, [width, height], id)
              ?.addService(googletag.pubads());
          }

          if (slot) {
            // Track this slot as defined
            definedSlots.add(id);
            slotRef.current = slot;

            googletag.display(id);

            // Listen for render events to hide placeholder if needed
            googletag.pubads().addEventListener(
              'slotRenderEnded',
              (event: any) => {
                if (event.slot === slot) {
                  setIsAdLoaded(!event.isEmpty);
                }
              }
            );
          }
        });
      })
      .catch(() => {
        setIsAdLoaded(false);
      });

    return () => {
      cancelled = true;

      // Cleanup: Destroy slot to prevent memory leaks in SPA navigation
      const slotToDestroy = slotRef.current;
      const slotId = id;
      if (slotToDestroy) {
        const googletag = ensureGoogleTag();

        googletag.cmd.push(() => {
          googletag.destroySlots([slotToDestroy]);
          definedSlots.delete(slotId);
          slotRef.current = null;
        });
      }
    };
  }, [config, placementKey, shouldLoadSlot]);

  // Effect to handle manual refresh triggers
  useEffect(() => {
    if (!config || !slotRef.current || !window.googletag?.pubads) return;

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
      <div ref={containerRef} className="flex flex-col items-center">
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
