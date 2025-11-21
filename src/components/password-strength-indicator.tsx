
'use client';

import { cn } from "@/lib/utils";

const strengthLevels = [
  { level: 0, text: '', className: '' },
  { level: 1, text: 'Weak', className: 'bg-red-500' },
  { level: 2, text: 'Medium', className: 'bg-yellow-500' },
  { level: 3, text: 'Strong', className: 'bg-green-500' },
];

interface PasswordStrengthIndicatorProps {
  strength: number;
}

export function PasswordStrengthIndicator({ strength }: PasswordStrengthIndicatorProps) {
  const currentLevel = strengthLevels[strength] || strengthLevels[0];

  if (strength === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="grid grid-cols-3 gap-1 w-full">
        {strengthLevels.slice(1).map(({ level, className }) => (
          <div key={level} className="h-1.5 rounded-full bg-muted">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                strength >= level ? className : ''
              )}
            />
          </div>
        ))}
      </div>
      <p className="text-xs font-medium text-muted-foreground w-16 text-right">
        {currentLevel.text}
      </p>
    </div>
  );
}
