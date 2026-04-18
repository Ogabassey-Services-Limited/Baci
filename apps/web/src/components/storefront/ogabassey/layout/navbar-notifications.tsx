'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '../components/empty-state';

interface NavbarNotificationsProps {
  basePath: string;
}

export function NavbarNotifications({
  basePath,
}: NavbarNotificationsProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showNotifications) {
      return undefined;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  return (
    <div className="relative flex items-center" ref={notificationRef}>
      <button
        onClick={() => setShowNotifications((current) => !current)}
        className={`relative flex items-center justify-center hover:text-white transition-colors ${showNotifications ? 'text-white' : ''}`}
      >
        <Bell size={22} />
      </button>

      {showNotifications && (
        <div className="absolute top-full right-0 mt-4 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-0 animate-in fade-in slide-in-from-top-2 z-50 overflow-hidden">
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
              onClick={() => setShowNotifications(false)}
              className="text-[10px] font-bold text-gray-600 hover:text-gray-900 block py-1"
            >
              View All
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
