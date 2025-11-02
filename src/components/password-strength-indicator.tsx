
'use client';

import { cn } from "@/lib/utils";

const strengthLevels = [
  { level: 0, text: '', className: '' },
  { level: 1, text: 'Weak', className: 'bg-red-500' },
  { level: 2, text: 'Medium', className: 'bg-yellow-500' },
  { level: 3, text: 'Strong', className: 'bg-green-500' },
];

export const checkPasswordStrength = (password: string): number => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/\d/.test(password)) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score > 3) return 3; // Cap at strong
    if (score > 0 && password.length < 8) return 1; // If it has something but is short, it's weak
    return score > 0 ? Math.min(score, 3) : 0;
};


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
