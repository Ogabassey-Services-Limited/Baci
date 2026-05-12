'use client';

import { Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useLoyalty } from '@/hooks/use-loyalty';
import { useMerchant } from '@/hooks/use-merchant-client';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface LoyaltyBadgeProps {
  merchantId?: string;
  customerId?: string;
  className?: string;
  showPoints?: boolean;
  compact?: boolean;
  rewardsHref?: string;
}

export function LoyaltyBadge({
  merchantId,
  customerId,
  className,
  showPoints = true,
  compact = false,
  rewardsHref,
}: LoyaltyBadgeProps) {
  const { basePath } = useMerchant();
  const { enrolled, pointsBalance, tier, loading, getTierInfo } = useLoyalty(
    merchantId,
    customerId
  );

  const targetHref = rewardsHref || `${basePath || ''}/pages/rewards`;

  // Don't show anything if not enrolled or still loading
  if (loading || !enrolled) {
    return null;
  }

  const tierInfo = getTierInfo(tier);

  if (compact) {
    return (
      <Link
        href={asRoute(targetHref)}
        className={cn('flex items-center gap-1', className)}
      >
        <Badge
          variant="outline"
          className={cn(
            'gap-1 cursor-pointer hover:opacity-80 transition-opacity',
            tierInfo.colors.bg,
            tierInfo.colors.text,
            tierInfo.colors.border
          )}
        >
          <Sparkles className="h-3 w-3" />
          {showPoints
            ? pointsBalance.toLocaleString()
            : tier.charAt(0).toUpperCase() + tier.slice(1)}
        </Badge>
      </Link>
    );
  }

  return (
    <Link
      href={asRoute(targetHref)}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full transition-all hover:shadow-md',
        tierInfo.colors.bg,
        tierInfo.colors.border,
        'border',
        className
      )}
    >
      <Sparkles className={cn('h-4 w-4', tierInfo.colors.text)} />
      <span className={cn('text-sm font-medium', tierInfo.colors.text)}>
        {pointsBalance.toLocaleString()} pts
      </span>
    </Link>
  );
}
