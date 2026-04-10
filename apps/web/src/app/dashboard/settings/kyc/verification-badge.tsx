import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationBadgeProps {
  verified: boolean;
}

export function VerificationBadge({ verified }: VerificationBadgeProps) {
  return (
    <output
      aria-label={verified ? 'Verified' : 'Verification not started'}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        verified ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
      )}
    >
      {verified ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          Verified
        </>
      ) : (
        'Not Started'
      )}
    </output>
  );
}
