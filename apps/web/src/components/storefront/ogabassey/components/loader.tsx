import type React from 'react';
import { Logo } from '../layout/logo';

export const OgabasseyLoader: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full h-full bg-white p-8">
      <Logo isLoading height={80} className="w-auto" />
      <p className="mt-4 text-gray-400 text-sm font-medium animate-pulse">
        Loading amazing gadgets…
      </p>
    </div>
  );
};
