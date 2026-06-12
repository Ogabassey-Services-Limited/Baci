'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import type React from 'react';
import { useSyncExternalStore } from 'react';

function subscribeToNetworkStatus(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);

  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

const getIsOffline = () => !navigator.onLine;

// Server snapshot: assume online (navigator not available on server), matching
// the previous hydration-safe `useState(false)` default.
const getServerIsOffline = () => false;

export const OfflineNotice: React.FC = () => {
  const isOffline = useSyncExternalStore(
    subscribeToNetworkStatus,
    getIsOffline,
    getServerIsOffline
  );

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 z-100 w-[90%] md:w-auto min-w-[300px] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#1a1a1a] text-white px-4 py-3 rounded-xl shadow-2xl border border-red-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-red-600/20 flex items-center justify-center text-red-500">
            <WifiOff size={18} />
          </div>
          <div>
            <p className="text-sm font-bold">No Internet Connection</p>
            <p className="text-xs text-gray-400">
              Please check your network settings.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-gray-300 hover:text-white"
          aria-label="Refresh page"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  );
};
