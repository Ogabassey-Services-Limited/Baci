/**
 * LoadingScreen Component
 *
 * 2026 Best Practices:
 * - Accessible loading indicator
 * - Consistent styling
 */

import { Loader2 } from 'lucide-react';
import type { LoadingScreenProps } from '../types';

/**
 * Full-screen loading indicator
 */
export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
