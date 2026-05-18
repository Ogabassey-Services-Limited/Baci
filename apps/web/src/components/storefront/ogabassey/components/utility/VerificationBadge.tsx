'use client';

import { Check, X } from 'lucide-react';

interface VerificationBadgeProps {
  verified: boolean;
  customerName?: string;
  message?: string;
  isLoading: boolean;
}

export function VerificationBadge({
  verified,
  customerName,
  message,
  isLoading,
}: VerificationBadgeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 animate-pulse">
        <div className="w-5 h-5 rounded-full bg-gray-300" />
        <span className="text-sm text-gray-400">Verifying customer...</span>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-200">
        <Check size={18} className="text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">{customerName}</p>
          <p className="text-xs text-green-600">Customer verified</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl border border-red-200">
      <X size={18} className="text-red-600 shrink-0" />
      <p className="text-sm text-red-700">
        {message || 'Verification failed'}
      </p>
    </div>
  );
}
