'use client';

import { ExternalLink, Quote, Star } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { escapeHtml } from '@/lib/sanitize-core';

/**
 * Google Reviews Section Component
 *
 * Displays Google Places reviews as testimonials
 * Uses Google Places API (max 5 reviews limitation)
 *
 * For Baci landing page: Set BACI_GOOGLE_PLACE_ID env var
 * For merchants: Pass placeId prop from merchant settings
 */

interface GoogleReview {
  authorName: string;
  authorUrl?: string;
  authorPhoto?: string;
  rating: number;
  text: string;
  relativeTime: string;
  timestamp: number;
}

interface GoogleReviewsData {
  reviews: GoogleReview[];
  rating: number;
  totalReviews: number;
  businessName?: string;
  googleMapsUrl?: string;
}

interface GoogleReviewsSectionProps {
  /** Google Place ID for the business */
  placeId?: string;
  /** Whether this section is enabled */
  enabled?: boolean;
  /** Section title override */
  title?: string;
  /** Section subtitle override */
  subtitle?: string;
  /** Max reviews to display (default 3) */
  maxReviews?: number;
  /** Custom class for the section */
  className?: string;
}

function StarRating({
  rating,
  size = 'md',
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className="flex" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${star <= rating
            ? 'fill-yellow-400 text-yellow-400'
            : star - 0.5 <= rating
              ? 'fill-yellow-400/50 text-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
            }`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: GoogleReview }) {
  // Truncate long reviews
  const maxLength = 200;
  const isLong = review.text.length > maxLength;
  const [expanded, setExpanded] = useState(false);

  const displayText = expanded ? review.text : review.text.slice(0, maxLength);

  return (
    <article className="bg-white dark:bg-slate-950 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-shadow h-full flex flex-col">
      <Quote
        className="w-8 h-8 text-accent/20 mb-4 flex-shrink-0"
        aria-hidden="true"
      />

      <p className="text-muted-foreground mb-4 flex-grow leading-relaxed">
        &ldquo;{displayText}
        {isLong && !expanded && '...'}&rdquo;
        {isLong && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-primary hover:underline text-sm font-medium mt-2"
          >
            {expanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>

      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
        {review.authorPhoto ? (
          <Image
            src={review.authorPhoto}
            alt=""
            width={40}
            height={40}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-accent font-semibold text-sm">
              {review.authorName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-grow min-w-0">
          <div className="font-medium text-primary dark:text-white truncate">
            {review.authorName}
          </div>
          <div className="flex items-center gap-2">
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-muted-foreground">
              {review.relativeTime}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export function GoogleReviewsSection({
  placeId,
  enabled = true,
  title = 'What Our Customers Say',
  subtitle,
  maxReviews = 3,
  className = '',
}: GoogleReviewsSectionProps) {
  const [data, setData] = useState<GoogleReviewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use env var for Baci's own Place ID if not provided
  const effectivePlaceId =
    placeId || process.env.NEXT_PUBLIC_BACI_GOOGLE_PLACE_ID;

  useEffect(() => {
    if (!enabled || !effectivePlaceId) {
      setLoading(false);
      return;
    }

    fetch(
      `/api/google-places/reviews?placeId=${encodeURIComponent(effectivePlaceId)}`
    )
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch reviews');
        return res.json();
      })
      .then((reviewsData: GoogleReviewsData) => {
        setData(reviewsData);
        setError(null);
      })
      .catch((err) => {
        console.error('Error fetching Google reviews:', err);
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [effectivePlaceId, enabled]);

  // Don't render if disabled, no place ID, or error
  if (!enabled || !effectivePlaceId || error) {
    return null;
  }

  // Don't render if loading or no reviews
  if (loading || !data || data.reviews.length === 0) {
    return null;
  }

  const displayedReviews = data.reviews.slice(0, maxReviews);

  // Generate Review schema for SEO
  const reviewSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: data.businessName || 'Baci',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.rating,
      reviewCount: data.totalReviews,
      bestRating: 5,
      worstRating: 1,
    },
    review: displayedReviews.map((r) => ({
      '@type': 'Review',
      author: {
        '@type': 'Person',
        name: escapeHtml(r.authorName),
      },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: escapeHtml(r.text),
      datePublished: new Date(r.timestamp * 1000).toISOString(),
    })),
  };

  return (
    <section className={`py-24 bg-slate-50 dark:bg-slate-900/50 ${className}`}>
      <div
        className="container"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl mb-4 text-primary dark:text-white">
            {title}
          </h2>

          {/* Overall Rating */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <StarRating rating={data.rating} size="lg" />
            <span className="text-2xl font-bold text-primary dark:text-white">
              {data.rating.toFixed(1)}
            </span>
            <span className="text-muted-foreground">
              based on {data.totalReviews.toLocaleString()} reviews
            </span>
          </div>

          {subtitle && (
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}

          {/* Google attribution */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="text-sm text-muted-foreground">
              Reviews from Google
            </span>
          </div>
        </div>

        {/* Reviews Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {displayedReviews.map((review, i) => (
            <ReviewCard
              key={`${review.authorName}-${review.timestamp}-${i}`}
              review={review}
            />
          ))}
        </div>

        {/* View all reviews link */}
        {data.googleMapsUrl && (
          <div className="text-center mt-8">
            <a
              href={data.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-accent hover:text-accent/80 font-medium transition-colors"
            >
              View all {data.totalReviews.toLocaleString()} reviews on Google
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}

        {/* Schema markup for SEO */}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(reviewSchema),
          }}
        />
      </div>
    </section>
  );
}

export default GoogleReviewsSection;
