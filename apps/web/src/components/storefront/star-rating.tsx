'use client';

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  showValue?: boolean;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  showValue = false,
  className,
}: StarRatingProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleClick = (index: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(index + 1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (interactive && onRatingChange && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onRatingChange(index + 1);
    }
  };

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: maxRating }).map((_, index) => {
        const filled = index < Math.floor(rating);
        const partial = index === Math.floor(rating) && rating % 1 !== 0;
        const fillPercentage = partial ? (rating % 1) * 100 : 0;

        return (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: Stars have stable order
            key={index}
            type="button"
            onClick={() => handleClick(index)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={!interactive}
            className={cn(
              'relative transition-transform',
              interactive &&
                'cursor-pointer hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded',
              !interactive && 'cursor-default'
            )}
            aria-label={
              interactive ? `Rate ${index + 1} out of ${maxRating}` : undefined
            }
          >
            {/* Background star (empty) */}
            <Star
              className={cn(sizeClasses[size], 'text-muted-foreground/30')}
            />
            {/* Filled star overlay */}
            {(filled || partial) && (
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ width: filled ? '100%' : `${fillPercentage}%` }}
              >
                <Star
                  className={cn(
                    sizeClasses[size],
                    'text-yellow-400 fill-yellow-400'
                  )}
                />
              </div>
            )}
          </button>
        );
      })}
      {showValue && (
        <span className="ml-1 text-sm text-muted-foreground">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

interface RatingSummaryProps {
  averageRating: number;
  reviewCount: number;
  distribution?: Record<string, number>;
  showDistribution?: boolean;
  className?: string;
}

export function RatingSummary({
  averageRating,
  reviewCount,
  distribution,
  showDistribution = true,
  className,
}: RatingSummaryProps) {
  // Calculate max count for bar width normalization
  const distributionMax = distribution
    ? Math.max(...Object.values(distribution), 1)
    : 1;
  void distributionMax; // Used for potential future bar width calculation

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-4xl font-bold">{averageRating.toFixed(1)}</div>
          <StarRating rating={averageRating} size="md" />
          <div className="text-sm text-muted-foreground mt-1">
            {reviewCount} {reviewCount === 1 ? 'review' : 'reviews'}
          </div>
        </div>

        {showDistribution && distribution && (
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars.toString()] || 0;
              const percentage =
                reviewCount > 0 ? (count / reviewCount) * 100 : 0;

              return (
                <div key={stars} className="flex items-center gap-2 text-sm">
                  <span className="w-3">{stars}</span>
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-400 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-muted-foreground text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
