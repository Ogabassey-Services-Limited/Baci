'use client';

import Image from 'next/image';
import { useState } from 'react';
import { SantaChatDialog } from './santa-chat-dialog';

/**
 * Floating Santa Widget
 *
 * A festive floating button that opens the Santa chat experience.
 * Only displayed on the Ogabassey storefront.
 */
export function SantaWidget() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-red-600 text-white shadow-2xl flex items-center justify-center hover:bg-red-700 transition-all duration-300 hover:scale-110 animate-bounce"
          style={{ animationDuration: '2s' }}
          aria-label="Chat with Santa"
        >
          <Image
            src="/african-santa-head.svg"
            alt="Santa"
            width={48}
            height={48}
            sizes="64px"
          />
        </button>
      )}

      {/* Chat dialog overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 md:p-6">
          {/* Backdrop */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop click to close is supplementary to close button */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop is a click-to-dismiss overlay */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Chat window */}
          <div className="relative z-10 w-full max-w-md h-[80vh] md:h-[600px] shadow-2xl rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <SantaChatDialog onClose={() => setIsOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
