interface ProductRatingRowProps {
  rating?: number;
}

const STAR_POSITIONS = [1, 2, 3, 4, 5] as const;

function normalizeRating(rating?: number) {
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) {
    return 0;
  }

  return Math.min(rating, 5);
}

function formatRating(rating?: number) {
  const normalizedRating = normalizeRating(rating);

  if (normalizedRating === 0) {
    return '0';
  }

  return Number.isInteger(normalizedRating)
    ? String(normalizedRating)
    : normalizedRating.toFixed(1);
}

export function ProductRatingRow({ rating }: ProductRatingRowProps) {
  const normalizedRating = normalizeRating(rating);
  const displayRating = formatRating(rating);
  const roundedRating = Math.floor(normalizedRating);

  return (
    <div
      aria-label={`Rated ${displayRating} out of 5`}
      className="flex items-center mb-1.5 flex-wrap gap-y-1"
      role="img"
    >
      <div aria-hidden="true" className="flex items-center gap-1">
        {STAR_POSITIONS.map((star) => (
          <span
            className={`text-xs leading-none ${
              star <= roundedRating ? 'text-store-rating' : 'text-store-border'
            }`}
            key={star}
          >
            ★
          </span>
        ))}
        <span className="text-[10px] text-store-background-text/55 ml-1">
          ({displayRating})
        </span>
      </div>
    </div>
  );
}
