'use client';

import { cn } from '@/lib/utils';

const strengthLevels = [
  { level: 0, text: '', className: '' },
  { level: 1, text: 'Weak', className: 'bg-red-500' },
  { level: 2, text: 'Medium', className: 'bg-yellow-500' },
  { level: 3, text: 'Strong', className: 'bg-green-500' },
];

interface PasswordStrengthIndicatorProps {
  strength: number;
}

export function PasswordStrengthIndicator({
  strength,
}: PasswordStrengthIndicatorProps) {
  const clamped = Math.max(0, Math.min(3, strength));
  const currentLevel = strengthLevels[clamped];

  if (clamped === 0) return null;

  return (
    // biome-ignore lint/a11y/useSemanticElements: Custom design requires div structure
    <div
      className="flex items-center gap-2 mt-2"
      role="meter"
      aria-label="Password strength"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={3}
      aria-valuetext={currentLevel.text}
      aria-live="polite"
    >
      <div className="grid grid-cols-3 gap-1 w-full" aria-hidden="true">
        {strengthLevels.slice(1).map(({ level, className }) => (
          <div key={level} className="h-1.5 rounded-full bg-muted">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                clamped >= level ? className : ''
              )}
            />
          </div>
        ))}
      </div>
      <p
        className="text-xs font-medium text-muted-foreground w-16 text-right"
        aria-hidden="true"
      >
        {currentLevel.text}
      </p>
    </div>
  );
}
