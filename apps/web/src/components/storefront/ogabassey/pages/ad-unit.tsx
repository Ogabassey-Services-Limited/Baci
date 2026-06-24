'use client';

import type React from 'react';
import { AD_CONFIG } from './ad-config';

interface AdUnitProps {
  placementKey: keyof typeof AD_CONFIG;
  className?: string;
}

export const AdUnit: React.FC<AdUnitProps> = ({
  placementKey,
  className = '',
}) => {
  const config = AD_CONFIG[placementKey];

  if (!config) return null;

  return (
    <div
      className={`w-full flex justify-center items-center my-6 ${className}`}
    >
      <div className="flex flex-col items-center">
        <span className="ogabassey-ad-placeholder-text text-[9px] uppercase tracking-widest mb-1 self-start ml-1">
          Sponsored
        </span>

        {/*
          --- AD CONTAINER ---
          We use style prop to enforce dimensions dynamically based on config.
          This prevents the page from jumping around (CLS) when the ad loads.
        */}
        <div
          className="relative overflow-hidden bg-gray-50 border border-gray-100 flex flex-col items-center justify-center text-center shadow-sm"
          style={{
            // We use CSS variables or classes in a real app, but inline styles ensure
            // the exact pixel dimensions requested by ad networks are respected.
            width: '100%',
            maxWidth: `${config.width}px`,
            height: `${config.height}px`,
          }}
        >
          {/* Mobile vs Desktop Logic would be handled by the Ad Network Script (DFP/AdSense)
              mapping, but visually we reserve the desktop size or max-width here.

              In a real implementation, you might use a <picture> tag or media queries
              to switch the container height.
          */}

          <div
            className="w-full h-full flex flex-col items-center justify-center p-4"
            style={{
              backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb 0, #e5e7eb 1px, transparent 1px, transparent 10px)'
            }}
          >
            <span className="ogabassey-ad-placeholder-text text-xs font-bold uppercase tracking-widest mb-1">
              Ad Space
            </span>
            <span className="ogabassey-ad-placeholder-text text-[10px] font-medium">
              {config.name}
            </span>
            <span className="ogabassey-ad-placeholder-text text-[9px] mt-1">
              {config.width}x{config.height}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
