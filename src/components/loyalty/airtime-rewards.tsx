'use client';

import { Check, Gift, Loader2, Phone, Star, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface AirtimeReward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  airtime_amount: number;
  network_provider: string | null;
}

interface NetworkProvider {
  id: string;
  name: string;
  color: string;
}

const NETWORK_PROVIDERS: NetworkProvider[] = [
  { id: 'MTN', name: 'MTN', color: '#FFCC00' },
  { id: 'AIRTEL', name: 'Airtel', color: '#FF0000' },
  { id: 'GLO', name: 'Glo', color: '#00FF00' },
  { id: '9MOBILE', name: '9mobile', color: '#006400' },
];

interface AirtimeRewardsProps {
  merchantSlug: string;
  customerPoints: number;
  onRedemption?: () => void;
  className?: string;
}

export function AirtimeRewards({
  merchantSlug,
  customerPoints,
  onRedemption,
  className,
}: AirtimeRewardsProps) {
  const [rewards, setRewards] = useState<AirtimeReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<AirtimeReward | null>(
    null
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [networkProvider, setNetworkProvider] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRewards = async () => {
      try {
        const response = await fetch(
          `/api/vtu/loyalty/rewards?merchantSlug=${merchantSlug}`
        );
        const data = await response.json();
        if (response.ok) {
          setRewards(data.rewards || []);
        }
      } catch (err) {
        console.error('Failed to fetch airtime rewards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRewards();
  }, [merchantSlug]);

  const handleRedeem = async () => {
    if (!selectedReward) return;

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    const provider = selectedReward.network_provider || networkProvider;
    if (!provider) {
      setError('Please select a network provider');
      return;
    }

    setIsRedeeming(true);
    setError(null);

    try {
      const response = await fetch('/api/vtu/loyalty/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rewardId: selectedReward.id,
          phoneNumber,
          networkProvider: provider,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setRedeemSuccess(true);
        onRedemption?.();
        setTimeout(() => {
          setSelectedReward(null);
          setPhoneNumber('');
          setNetworkProvider('');
          setRedeemSuccess(false);
        }, 3000);
      } else {
        setError(data.error || 'Redemption failed');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsRedeeming(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (rewards.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-purple-600" />
        <h3 className="font-semibold">Airtime Rewards</h3>
      </div>

      <div className="grid gap-3">
        {rewards.map((reward) => {
          const canAfford = customerPoints >= reward.points_required;

          return (
            <button
              type="button"
              key={reward.id}
              onClick={() => canAfford && setSelectedReward(reward)}
              disabled={!canAfford}
              className={cn(
                'w-full p-4 rounded-lg border text-left transition-all',
                canAfford
                  ? 'hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer'
                  : 'opacity-50 cursor-not-allowed',
                'flex items-center justify-between'
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                  <Phone className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-medium">{reward.name}</p>
                  <p className="text-sm text-muted-foreground">
                    ₦{reward.airtime_amount.toLocaleString()} airtime
                    {reward.network_provider &&
                      ` • ${reward.network_provider} only`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm font-medium">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                {reward.points_required.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Your points:{' '}
        <span className="font-semibold">{customerPoints.toLocaleString()}</span>
      </p>

      {/* Redemption Dialog */}
      <Dialog
        open={!!selectedReward}
        onOpenChange={() => setSelectedReward(null)}
      >
        <DialogContent>
          {redeemSuccess ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle>Airtime Sent!</DialogTitle>
              <DialogDescription>
                ₦{selectedReward?.airtime_amount.toLocaleString()} has been sent
                to {phoneNumber}
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Redeem Airtime Reward</DialogTitle>
                <DialogDescription>
                  Get ₦{selectedReward?.airtime_amount.toLocaleString()} airtime
                  for {selectedReward?.points_required.toLocaleString()} points
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="redeem-phone">Phone Number</Label>
                  <Input
                    id="redeem-phone"
                    type="tel"
                    placeholder="08012345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>

                {!selectedReward?.network_provider && (
                  <div className="space-y-2">
                    <Label>Network Provider</Label>
                    <Select
                      value={networkProvider}
                      onValueChange={setNetworkProvider}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select network" />
                      </SelectTrigger>
                      <SelectContent>
                        {NETWORK_PROVIDERS.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: provider.color }}
                              />
                              {provider.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {selectedReward?.network_provider && (
                  <p className="text-sm text-muted-foreground">
                    This reward is for {selectedReward.network_provider} only
                  </p>
                )}

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <X className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <Button
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                  className="w-full"
                >
                  {isRedeeming ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 h-4 w-4" />
                      Redeem for{' '}
                      {selectedReward?.points_required.toLocaleString()} points
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
