'use client';

interface CarouselPlayToggleProps {
  isPlaying: boolean;
  onToggle: () => void;
  className?: string;
}

/**
 * Accessible pause/play control for an auto-rotating carousel. WCAG 2.2.2
 * (Pause, Stop, Hide) treats this persistent control as required for content
 * that auto-advances for more than 5 seconds.
 */
export function CarouselPlayToggle({
  isPlaying,
  onToggle,
  className = '',
}: CarouselPlayToggleProps) {
  return (
    <button
      aria-label={isPlaying ? 'Pause auto-rotation' : 'Play auto-rotation'}
      aria-pressed={!isPlaying}
      className={`flex h-11 min-w-11 items-center justify-center rounded-full text-store-on-primary ${className}`}
      onClick={onToggle}
      type="button"
    >
      <svg
        aria-hidden="true"
        fill="currentColor"
        height="14"
        viewBox="0 0 12 14"
        width="12"
      >
        {isPlaying ? (
          <>
            <rect height="14" rx="1" width="4" x="0" y="0" />
            <rect height="14" rx="1" width="4" x="8" y="0" />
          </>
        ) : (
          <path d="M0 0v14l12-7z" />
        )}
      </svg>
    </button>
  );
}
