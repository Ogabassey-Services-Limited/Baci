import React from 'react';
import { Megaphone } from 'lucide-react';

export const AdUnit: React.FC<{ placementKey: string }> = ({ placementKey }) => {
  return (
    <div className="w-full h-32 md:h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2 hover:bg-gray-100 transition-colors cursor-pointer group">
      <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
        <Megaphone size={24} className="text-gray-300 group-hover:text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-500">Sponsored Content</p>
        <p className="text-xs text-gray-400">{placementKey}</p>
      </div>
    </div>
  );
};