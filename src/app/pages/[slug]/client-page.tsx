'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useMerchant } from '@/hooks/use-merchant';
import { findDarkestColor, getContrastingTextColor } from '@/lib/color-utils';
import { sanitizeHtml } from '@/lib/sanitize';

export function ClientPage({ slug }: { slug: string }) {
  const { merchant, loading } = useMerchant();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (
    !merchant ||
    !merchant.pages ||
    !merchant.pages[slug as keyof typeof merchant.pages]
  ) {
    notFound();
  }

  const pageContent = merchant.pages[slug as keyof typeof merchant.pages];
  const pageTitle = slug.charAt(0).toUpperCase() + slug.slice(1);

  const brandColors = merchant.brand_colors
    ? [
        merchant.brand_colors.primary,
        merchant.brand_colors.background,
        merchant.brand_colors.accent,
      ].filter(Boolean)
    : ['#3F51B5'];
  const darkestColor = findDarkestColor(brandColors as string[]);

  return (
    <div
      style={
        {
          '--store-primary': merchant.brand_colors?.primary,
          '--store-background': merchant.brand_colors?.background,
          '--store-accent': merchant.brand_colors?.accent,
        } as React.CSSProperties
      }
    >
      <header className="px-4 lg:px-6 h-16 flex items-center shadow-sm">
        <Link
          href="/"
          className="flex items-center justify-center font-semibold"
        >
          {merchant.business_name}
        </Link>
      </header>
      <main className="container mx-auto max-w-3xl py-12 px-4">
        <h1
          className="text-4xl font-bold mb-8"
          style={{ color: 'var(--store-primary)' }}
        >
          {pageTitle}
        </h1>
        <div
          className="prose dark:prose-invert max-w-none"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Content sanitized with sanitizeHtml()
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(pageContent || '') }}
        />
      </main>
      <footer
        className="text-white mt-12"
        style={{
          backgroundColor: darkestColor,
          color: getContrastingTextColor(darkestColor),
        }}
      >
        <div className="container mx-auto py-8 px-4 md:px-6 text-center">
          <p>
            &copy; {new Date().getFullYear()} {merchant.business_name}. All
            rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
