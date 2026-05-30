'use client';

// This stays client-side because the icon is rendered directly inside
// interactive dashboard order card client components.

import { CircleDot, Globe, PencilLine, Store } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import {
  getOrderSourceLabel,
  normalizeOrderSource,
} from './order-source-display';

function BrandIconFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-label={label}
      role="img"
      className="inline-flex items-center justify-center"
    >
      {children}
    </span>
  );
}

function WhatsAppIcon({ label }: { label: string }) {
  return (
    <BrandIconFrame label={label}>
      <svg
        className="size-5 text-[#25D366]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 12c0 1.74.45 3.38 1.26 4.84l-1.33 4.85 4.97-1.3c1.4.78 2.98 1.21 4.61 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-5.46-4.45-9.91-9.91-9.91zM17.48 15.36c-.21.6-1.3 1.12-1.79 1.18-.49.06-1.04.06-1.57-.09-.53-.15-1.12-.34-1.84-1.1-1.02-1.08-1.7-2.35-1.93-2.76-.23-.41-.03-.63.18-.84.2-.21.41-.35.56-.53.15-.18.2-.3.15-.49-.06-.18-.53-1.27-.73-1.76s-.4-.41-.56-.41h-.48c-.18 0-.4.18-.56.41-.18.21-.69.69-.69 1.69s.71 1.97.81 2.12c.1.15 1.41 2.35 3.43 3.21.49.21.87.34 1.18.43.53.15.99.12 1.36-.03.44-.18.69-.81.79-1.53.1-.71.1-1.3-.03-1.48-.06-.18-.24-.27-.45-.45z" />
      </svg>
    </BrandIconFrame>
  );
}

function InstagramIcon({ label }: { label: string }) {
  return (
    <BrandIconFrame label={label}>
      <svg
        className="size-5 text-[#E1306C]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.5A4.25 4.25 0 0 0 3.5 7.75v8.5A4.25 4.25 0 0 0 7.75 20.5h8.5a4.25 4.25 0 0 0 4.25-4.25v-8.5A4.25 4.25 0 0 0 16.25 3.5Zm4.25 3.25a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5Zm0 1.5a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Zm5.5-.93a1.18 1.18 0 1 1 0 2.36 1.18 1.18 0 0 1 0-2.36Z" />
      </svg>
    </BrandIconFrame>
  );
}

function FacebookIcon({ label }: { label: string }) {
  return (
    <BrandIconFrame label={label}>
      <svg
        className="size-5 text-[#1877F2]"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M13.64 21v-7.29h2.45L16.46 11h-2.82V9.27c0-.79.22-1.33 1.35-1.33h1.62V5.51c-.28-.04-1.23-.11-2.34-.11-2.31 0-3.9 1.41-3.9 4v1.6H8v2.71h2.37V21h3.27Z" />
      </svg>
    </BrandIconFrame>
  );
}

function TikTokIcon({ label }: { label: string }) {
  return (
    <BrandIconFrame label={label}>
      <svg
        className="size-5 text-slate-900 dark:text-white"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M14.82 3c.55 2.01 1.76 3.26 3.88 3.45v2.31c-1.38-.07-2.63-.49-3.88-1.38v5.7a5.81 5.81 0 1 1-5.81-5.81c.4 0 .8.04 1.19.12v2.36a3.4 3.4 0 0 0-1.19-.22 3.55 3.55 0 1 0 3.55 3.55V3h2.26Z" />
      </svg>
    </BrandIconFrame>
  );
}

export function OrderSourceIcon({ source }: { source: string }) {
  const normalizedSource = normalizeOrderSource(source);
  const label = getOrderSourceLabel(source);

  if (normalizedSource === 'whatsapp') {
    return <WhatsAppIcon label={label} />;
  }

  if (normalizedSource === 'instagram') {
    return <InstagramIcon label={label} />;
  }

  if (normalizedSource === 'facebook') {
    return <FacebookIcon label={label} />;
  }

  if (normalizedSource === 'tiktok') {
    return <TikTokIcon label={label} />;
  }

  if (
    normalizedSource === 'online_store' ||
    normalizedSource === 'storefront' ||
    normalizedSource === 'web' ||
    normalizedSource === 'website'
  ) {
    return (
      <BrandIconFrame label={label}>
        <Globe className="size-5 text-cyan-300" />
      </BrandIconFrame>
    );
  }

  if (normalizedSource === 'manual' || normalizedSource === 'staff_entry') {
    return (
      <BrandIconFrame label={label}>
        <PencilLine className="size-5 text-slate-300" />
      </BrandIconFrame>
    );
  }

  if (normalizedSource === 'physical') {
    return (
      <BrandIconFrame label={label}>
        <Store className="size-5 text-orange-300" />
      </BrandIconFrame>
    );
  }

  if (normalizedSource === 'jumia') {
    return (
      <BrandIconFrame label={label}>
        <div className="relative size-6 overflow-hidden rounded-full border border-gray-100 bg-white shadow-sm">
          <Image
            src="/jumia-logo.png"
            alt=""
            fill
            sizes="24px"
            className="object-contain p-0.5"
          />
        </div>
      </BrandIconFrame>
    );
  }

  return (
    <BrandIconFrame label={label}>
      <CircleDot className="size-5 text-muted-foreground" />
    </BrandIconFrame>
  );
}
