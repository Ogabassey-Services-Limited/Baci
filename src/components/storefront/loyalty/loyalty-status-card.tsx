'use client';

import { Gift, Star, TrendingUp, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LoyaltyTier } from '@/hooks/use-loyalty';

interface LoyaltyStatusCardProps {
  isEnrolled: boolean;
  pointsBalance: number;
  lifetimePoints: number;
  currentTier: string | null;
  currentTierInfo?: LoyaltyTier;
  nextTier?: LoyaltyTier | null;
  pointsToNextTier?: number | null;
  referralCode: string | null;
  programName?: string;
  onViewRewards?: () => void;
  className?: string;
}

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Bronze: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  Silver: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
  Gold: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-400' },
  Platinum: { bg: 'bg-slate-800', text: 'text-white', border: 'border-slate-600' },
};

export function LoyaltyStatusCard({
  isEnrolled,
  pointsBalance,
  lifetimePoints,
  currentTier,
  currentTierInfo,
  nextTier,
  pointsToNextTier,
  referralCode,
  programName = 'Rewards',
  onViewRewards,
  className,
}: LoyaltyStatusCardProps) {
  const [copied, setCopied] = useState(false);

  const tierColors = currentTier ? TIER_COLORS[currentTier] || TIER_COLORS.Bronze : TIER_COLORS.Bronze;

  const handleCopyReferral = async () => {
    if (referralCode) {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculate progress to next tier
  const calculateProgress = () => {
    if (!nextTier || !currentTierInfo || pointsToNextTier === undefined || pointsToNextTier === null) return 100;
    const currentMin = currentTierInfo.minPoints;
    const nextMin = nextTier.minPoints;
    const range = nextMin - currentMin;
    const progress = lifetimePoints - currentMin;
    return Math.min(100, Math.floor((progress / range) * 100));
  };

  if (!isEnrolled) {
    return null;
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className={cn('pb-3', tierColors.bg)}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-lg font-semibold', tierColors.text)}>
            {programName}
          </CardTitle>
          {currentTier && (
            <Badge variant="outline" className={cn('font-medium', tierColors.border, tierColors.text)}>
              <Star className="mr-1 h-3 w-3" />
              {currentTier}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {/* Points Balance */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Available Points</p>
            <p className="text-2xl font-bold">{pointsBalance.toLocaleString()}</p>
          </div>
          <Gift className="h-8 w-8 text-primary opacity-50" />
        </div>

        {/* Tier Progress */}
        {nextTier && pointsToNextTier !== null && pointsToNextTier !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress to {nextTier.name}</span>
              <span className="font-medium">{pointsToNextTier.toLocaleString()} pts needed</span>
            </div>
            <Progress value={calculateProgress()} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {currentTierInfo?.multiplier && currentTierInfo.multiplier > 1 && (
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Earning {currentTierInfo.multiplier}x points
                </span>
              )}
            </p>
          </div>
        )}

        {/* Current Tier Perks */}
        {currentTierInfo?.perks && currentTierInfo.perks.length > 0 && (
          <div className="text-sm">
            <p className="text-muted-foreground mb-1">Your Perks:</p>
            <div className="flex flex-wrap gap-1">
              {currentTierInfo.perks.map((perk) => (
                <Badge key={perk} variant="secondary" className="text-xs">
                  {formatPerk(perk)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Referral Code */}
        {referralCode && (
          <div className="flex items-center justify-between p-2 bg-muted rounded-md">
            <div>
              <p className="text-xs text-muted-foreground">Your Referral Code</p>
              <p className="font-mono font-semibold">{referralCode}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyReferral}
              className="h-8 w-8 p-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}

        {/* View Rewards Button */}
        {onViewRewards && (
          <Button onClick={onViewRewards} className="w-full" variant="outline">
            <Gift className="mr-2 h-4 w-4" />
            View Rewards
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function formatPerk(perk: string): string {
  return perk
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default LoyaltyStatusCard;
