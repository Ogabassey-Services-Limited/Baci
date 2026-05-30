/**
 * LoginHeader Component
 *
 * 2026 Best Practices:
 * - Semantic HTML with header element
 * - Accessible navigation link
 */

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { LoginHeaderProps } from '../types';

/**
 * Login page header with back navigation
 */
export function LoginHeader({
  backHref = '/',
  backLabel = 'Back to store',
}: LoginHeaderProps) {
  return (
    <header className="relative z-10 border-b border-gray-100 bg-white">
      <div className="container mx-auto px-4 h-16 flex items-center">
        <Link
          href={asRoute(backHref)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>{backLabel}</span>
        </Link>
      </div>
    </header>
  );
}
