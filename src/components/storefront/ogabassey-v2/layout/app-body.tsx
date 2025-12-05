// @ts-nocheck - Template preview
import type React from 'react';

interface AppBodyProps {
  children: React.ReactNode;
}

export const AppBody: React.FC<AppBodyProps> = ({ children }) => {
  return (
    <div className="w-full min-h-screen bg-white font-sans text-gray-900 relative">
      {/* 
        TODO: Add global components here when migrated:
        - SnowEffect
        - ChatWidget
        - PopupSystem
        - OfflineNotice
        - UpsellToast
        - SavedToast
      */}
      {children}
    </div>
  );
};
