'use client';

import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface DidYouMeanBannerProps {
  originalQuery: string;
  suggestion: string;
  onSuggestionClick: (suggestion: string) => void;
}

export function DidYouMeanBanner({
  originalQuery,
  suggestion,
  onSuggestionClick,
}: DidYouMeanBannerProps) {
  return (
    <Alert className="mb-4">
      <AlertCircle className="size-4" />
      <AlertDescription>
        No results found for{' '}
        <span className="font-semibold">&quot;{originalQuery}&quot;</span>. Did
        you mean{' '}
        <button
          type="button"
          onClick={() => onSuggestionClick(suggestion)}
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          &quot;{suggestion}&quot;
        </button>
        ?
      </AlertDescription>
    </Alert>
  );
}
