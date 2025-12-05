import React from 'react';

interface AdUnitProps {
  placementKey: string;
  className?: string;
}

export const AdUnit: React.FC<AdUnitProps> = ({ placementKey, className }) => {
  return (
    <div
      className={`bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center p-4 text-gray-400 text-sm ${className}`}
    >
      Ad: {placementKey}
    </div>
  );
};
