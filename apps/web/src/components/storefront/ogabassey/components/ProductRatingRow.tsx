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

export function ProductRatingRow({ rating }: ProductRatingRowProps) {
  const normalizedRating = normalizeRating(rating);

  // Products without real review data get no rating row — rendering five
  // empty stars (or a fabricated score) misleads shoppers.
  if (normalizedRating === 0) {
    return null;
  }

  const displayRating = Number.isInteger(normalizedRating)
    ? String(normalizedRating)
    : normalizedRating.toFixed(1);
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
