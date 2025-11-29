'use client';

import { Gift, Percent, Truck, ShoppingBag, CreditCard, Lock, Clock } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LoyaltyReward, RedemptionResult } from '@/hooks/use-loyalty';

interface RewardsCatalogProps {
  rewards: LoyaltyReward[];
  pointsBalance: number;
  onRedeem: (rewardId: string) => Promise<RedemptionResult>;
  isRedeeming?: boolean;
  canRedeemCheck?: (reward: LoyaltyReward) => { canRedeem: boolean; reason?: string };
  className?: string;
}

const REWARD_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  discount_percentage: Percent,
  discount_fixed: CreditCard,
  free_shipping: Truck,
  free_product: ShoppingBag,
  store_credit: CreditCard,
};

export function RewardsCatalog({
  rewards,
  pointsBalance,
  onRedeem,
  isRedeeming = false,
  canRedeemCheck,
  className,
}: RewardsCatalogProps) {
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);

  const handleRedeemClick = (reward: LoyaltyReward) => {
    setSelectedReward(reward);
    setRedemptionResult(null);
  };

  const handleConfirmRedeem = async () => {
    if (!selectedReward) return;

    const result = await onRedeem(selectedReward.id);
    setRedemptionResult(result);

    if (result.success) {
      // Keep dialog open to show success
    }
  };

  const handleCloseDialog = () => {
    setSelectedReward(null);
    setRedemptionResult(null);
  };

  if (rewards.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Gift className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Rewards Available</h3>
        <p className="text-muted-foreground">
          Check back later for new rewards you can redeem with your points.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const Icon = REWARD_ICONS[reward.reward_type] || Gift;
          const checkResult = canRedeemCheck?.(reward) || {
            canRedeem: pointsBalance >= reward.points_cost,
          };
          const canAfford = pointsBalance >= reward.points_cost;
          const isAvailable = checkResult.canRedeem;

          return (
            <Card
              key={reward.id}
              className={cn(
                'flex flex-col transition-all',
                !isAvailable && 'opacity-75'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  {reward.stock_quantity !== undefined && reward.stock_quantity !== null && reward.stock_quantity <= 10 && (
                    <Badge variant="destructive" className="text-xs">
                      {reward.stock_quantity} left
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <h3 className="font-semibold mb-1">{reward.name}</h3>
                {reward.description && (
                  <p className="text-sm text-muted-foreground mb-2">
                    {reward.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-semibold">
                    {reward.points_cost.toLocaleString()} pts
                  </Badge>
                  {reward.reward_value && (
                    <span className="text-sm text-muted-foreground">
                      {reward.reward_type === 'discount_percentage'
                        ? `${reward.reward_value}% off`
                        : reward.reward_type === 'discount_fixed' || reward.reward_type === 'store_credit'
                          ? `₦${reward.reward_value.toLocaleString()}`
                          : null}
                    </span>
                  )}
                </div>
                {reward.minimum_order_amount && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Min. order: ₦{reward.minimum_order_amount.toLocaleString()}
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleRedeemClick(reward)}
                  disabled={!isAvailable || isRedeeming}
                  className="w-full"
                  variant={isAvailable ? 'default' : 'outline'}
                >
                  {!canAfford ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      {reward.points_cost - pointsBalance} more pts
                    </>
                  ) : !isAvailable ? (
                    <>
                      <Clock className="mr-2 h-4 w-4" />
                      {checkResult.reason}
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 h-4 w-4" />
                      Redeem
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Redemption Confirmation Dialog */}
      <Dialog open={!!selectedReward} onOpenChange={handleCloseDialog}>
        <DialogContent>
          {redemptionResult?.success ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <Gift className="h-5 w-5" />
                  Reward Redeemed!
                </DialogTitle>
                <DialogDescription>
                  You&apos;ve successfully redeemed {selectedReward?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-4">
                {redemptionResult.redemption?.code && (
                  <div className="bg-muted p-4 rounded-lg text-center">
                    <p className="text-sm text-muted-foreground mb-1">Your Reward Code</p>
                    <p className="font-mono text-xl font-bold">
                      {redemptionResult.redemption.code}
                    </p>
                  </div>
                )}
                <p className="text-sm text-muted-foreground">
                  Points spent: {redemptionResult.redemption?.pointsSpent.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">
                  New balance: {redemptionResult.redemption?.newBalance.toLocaleString()} pts
                </p>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDialog}>Done</Button>
              </DialogFooter>
            </>
          ) : redemptionResult?.error ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-destructive">Redemption Failed</DialogTitle>
                <DialogDescription>{redemptionResult.error}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Confirm Redemption</DialogTitle>
                <DialogDescription>
                  You&apos;re about to redeem {selectedReward?.name} for{' '}
                  {selectedReward?.points_cost.toLocaleString()} points.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="flex justify-between text-sm mb-2">
                  <span>Your current balance:</span>
                  <span className="font-medium">{pointsBalance.toLocaleString()} pts</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Points to redeem:</span>
                  <span className="font-medium text-destructive">
                    -{selectedReward?.points_cost.toLocaleString()} pts
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span>Balance after:</span>
                  <span className="font-medium">
                    {(pointsBalance - (selectedReward?.points_cost || 0)).toLocaleString()} pts
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmRedeem} disabled={isRedeeming}>
                  {isRedeeming ? 'Redeeming...' : 'Confirm Redemption'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default RewardsCatalog;
