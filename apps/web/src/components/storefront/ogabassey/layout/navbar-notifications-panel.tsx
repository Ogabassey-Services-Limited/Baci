'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { EmptyState } from '../components/empty-state';

interface NavbarNotificationsPanelProps {
  basePath: string;
  onClose: () => void;
}

export function NavbarNotificationsPanel({
  basePath,
  onClose,
}: NavbarNotificationsPanelProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      className="absolute top-full right-0 mt-4 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-0 animate-in fade-in slide-in-from-top-2 z-50 overflow-hidden"
      role="region"
      aria-label="Notifications"
    >
      <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
      </div>
      <div className="max-h-[300px] overflow-y-auto">
        <EmptyState
          variant="notifications"
          title="No Notifications"
          description="You have no unread notifications at this time."
          compact
        />
      </div>
      <div className="p-2 border-t border-gray-100 bg-gray-50 text-center">
        <Link
          href={`${basePath}/account` as `/${string}`}
          prefetch={false}
          onClick={onClose}
          className="text-xs font-bold text-gray-600 hover:text-gray-900 block py-1"
        >
          View All
        </Link>
      </div>
    </div>
  );
}
