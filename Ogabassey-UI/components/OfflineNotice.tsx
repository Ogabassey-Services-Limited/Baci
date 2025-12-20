import React, { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineNotice: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 transform -translate-x-1/2 z-[100] w-[90%] md:w-auto min-w-[300px] animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-[#1a1a1a] text-white px-4 py-3 rounded-xl shadow-2xl border border-red-500/30 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-600/20 flex items-center justify-center text-red-500">
            <WifiOff size={18} />
          </div>
          <div>
            <p className="text-sm font-bold">No Internet Connection</p>
            <p className="text-xs text-gray-400">Please check your network settings.</p>
          </div>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="bg-white/10 hover:bg-white/20 p-2 rounded-lg transition-colors text-gray-300 hover:text-white"
        >
          <RefreshCw size={18} />
        </button>
      </div>
    </div>
  );
};