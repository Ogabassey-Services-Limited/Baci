// Template preview component with dynamic routes
'use client';

import Link from 'next/link';
import type React from 'react';

interface EmptyStateProps {
  variant?:
  | 'cart'
  | 'saved'
  | 'search'
  | 'generic'
  | 'wallet'
  | 'orders'
  | 'history'
  | 'reviews'
  | 'address'
  | 'notifications';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionLink?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  actionLink,
  compact = false,
}) => {
  const Illustrations = {
    cart: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <path
          d="M65 65H135L128 115H72L65 65Z"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M72 65L62 45H45"
          stroke="#D1D5DB"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="80" cy="135" r="8" fill="#D1D5DB" />
        <circle cx="120" cy="135" r="8" fill="#D1D5DB" />
        <path
          d="M90 55L110 55L110 35L90 35L90 55Z"
          fill="#FECACA"
          stroke="#EF4444"
          strokeWidth="2"
          transform="rotate(-15 100 45)"
        />
        <path
          d="M85 85L115 115"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M115 85L85 115"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    ),
    saved: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        {/* Wishlist Board */}
        <rect
          x="60"
          y="50"
          width="80"
          height="100"
          rx="8"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="4"
        />
        <path
          d="M80 40H120"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinecap="round"
        />
        {/* Heart Items */}
        <path
          d="M75 70H125"
          stroke="#F3F4F6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M75 95H125"
          stroke="#F3F4F6"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M75 120H105"
          stroke="#F3F4F6"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Floating Hearts */}
        <path
          d="M135 135C135 135 145 125 155 135C165 145 135 165 135 165C135 165 105 145 115 135C125 125 135 135 135 135Z"
          fill="#FECACA"
          stroke="#EF4444"
          strokeWidth="2"
        />
        <path
          d="M45 65C45 65 52 58 59 65C66 72 45 86 45 86C45 86 24 72 31 65C38 58 45 65 45 65Z"
          fill="#FEE2E2"
          stroke="#FCA5A5"
          strokeWidth="2"
        />
      </svg>
    ),
    search: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <circle cx="90" cy="90" r="35" stroke="#E5E7EB" strokeWidth="4" />
        <path
          d="M115 115L145 145"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M80 85C80 85 85 80 95 85"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d="M100 75C100 75 102 70 105 72"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    ),
    wallet: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <rect
          x="55"
          y="70"
          width="90"
          height="60"
          rx="6"
          stroke="#E5E7EB"
          strokeWidth="4"
        />
        <path d="M55 85H145" stroke="#E5E7EB" strokeWidth="4" />
        <path
          d="M55 70L95 45L135 70"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="120" cy="100" r="6" fill="#D1D5DB" />
        <circle
          cx="85"
          cy="55"
          r="12"
          fill="#FECACA"
          stroke="#EF4444"
          strokeWidth="2"
        />
        <path
          d="M85 50V60M80 55H90"
          stroke="#EF4444"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    orders: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        {/* Package Box */}
        <path
          d="M50 80L100 105L150 80L100 55L50 80Z"
          fill="#F3F4F6"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M50 80V130L100 155V105L50 80Z"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M150 80V130L100 155V105L150 80Z"
          fill="#F9FAFB"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M100 105V155"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M100 55L50 35"
          stroke="#E5E7EB"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        {/* Floating Tag */}
        <path
          d="M130 65L160 50L170 60L140 75"
          fill="#FECACA"
          stroke="#EF4444"
          strokeWidth="2"
        />
        <circle cx="135" cy="70" r="2" fill="white" />
      </svg>
    ),
    history: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <circle cx="100" cy="100" r="40" stroke="#E5E7EB" strokeWidth="4" />
        <path
          d="M100 75V100L115 115"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M60 140L40 160"
          stroke="#EF4444"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <circle cx="40" cy="160" r="5" fill="#EF4444" />
      </svg>
    ),
    reviews: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <path
          d="M100 60L112 85H140L118 102L126 128L100 112L74 128L82 102L60 85H88L100 60Z"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
          fill="white"
        />
        <path
          d="M140 130L150 120M150 120L160 110M150 120L140 110M150 120L160 130"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill="#E5E7EB" />
        <path
          d="M70 150Q100 160 130 150"
          stroke="#EF4444"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.5"
        />
      </svg>
    ),
    address: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <path
          d="M100 150C100 150 135 115 135 85C135 65.67 119.33 50 100 50C80.67 50 65 65.67 65 85C65 115 100 150 100 150Z"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <circle cx="100" cy="85" r="12" fill="#F3F4F6" />
        <path
          d="M70 160H130"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M130 65L145 50M140 75L155 60"
          stroke="#EF4444"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
    notifications: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <path
          d="M100 50V40M100 150C100 155.523 95.523 160 90 160H110C104.477 160 100 155.523 100 150ZM65 130V90C65 70.67 80.67 55 100 55C119.33 55 135 70.67 135 90V130L145 140H55L65 130Z"
          fill="white"
          stroke="#E5E7EB"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M140 70L155 55"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M60 70L45 55"
          stroke="#EF4444"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="150" cy="60" r="4" fill="#FECACA" />
      </svg>
    ),
    generic: (
      <svg
        width="200"
        height="200"
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        <circle cx="100" cy="100" r="90" fill="#F9FAFB" />
        <rect
          x="65"
          y="70"
          width="70"
          height="60"
          rx="8"
          stroke="#E5E7EB"
          strokeWidth="4"
        />
        <path d="M65 90H135" stroke="#E5E7EB" strokeWidth="4" />
        <circle cx="100" cy="100" r="10" fill="#FCA5A5" opacity="0.5" />
      </svg>
    ),
  };

  const illustration = Illustrations[variant] || Illustrations.generic;

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 animate-in fade-in zoom-in-95 duration-300 ${compact ? 'py-8' : 'h-full py-12'}`}
    >
      <div
        className={`mb-6 flex justify-center ${compact ? 'w-24 h-24' : 'w-40 h-40 md:w-48 md:h-48'}`}
      >
        {illustration}
      </div>

      <h3
        className={`font-bold text-gray-900 mb-2 ${compact ? 'text-lg' : 'text-xl'}`}
      >
        {title}
      </h3>

      <p
        className={`text-gray-500 max-w-xs mx-auto mb-8 leading-relaxed ${compact ? 'text-xs' : 'text-sm'}`}
      >
        {description}
      </p>

      {actionLabel &&
        (actionLink ? (
          <Link
            href={actionLink as any}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-red-200 transform hover:-translate-y-0.5 active:scale-95"
          >
            {actionLabel}
          </Link>
        ) : (
          <button type="button"
            onClick={onAction}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg hover:shadow-red-200 transform hover:-translate-y-0.5 active:scale-95"
          >
            {actionLabel}
          </button>
        ))}
    </div>
  );
};
