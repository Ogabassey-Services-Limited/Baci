'use client';

import { useState } from 'react';
import { Gift, Sparkles, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { EnrollmentResult, LoyaltyTier } from '@/hooks/use-loyalty';

interface LoyaltyEnrollmentFormProps {
  programName?: string;
  signupBonusPoints?: number;
  referralBonusPoints?: number;
  tiers?: LoyaltyTier[];
  onEnroll: (
    email: string,
    options?: { name?: string; phone?: string; referralCode?: string }
  ) => Promise<EnrollmentResult>;
  isEnrolling?: boolean;
  defaultEmail?: string;
  defaultName?: string;
  className?: string;
}

export function LoyaltyEnrollmentForm({
  programName = 'Rewards Program',
  signupBonusPoints = 0,
  referralBonusPoints = 0,
  tiers = [],
  onEnroll,
  isEnrolling = false,
  defaultEmail = '',
  defaultName = '',
  className,
}: LoyaltyEnrollmentFormProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState(defaultName);
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<EnrollmentResult['enrollment'] | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email is required');
      return;
    }

    const result = await onEnroll(email, {
      name: name || undefined,
      referralCode: referralCode || undefined,
    });

    if (result.success && result.enrollment) {
      setSuccess(result.enrollment);
    } else {
      setError(result.error || 'Failed to enroll');
    }
  };

  if (success) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader className="bg-green-50 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <Sparkles className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-green-800">Welcome to {programName}!</CardTitle>
          <CardDescription className="text-green-700">
            You&apos;re now a member
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-primary">
              {success.pointsBalance.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">points earned</p>
          </div>
          {success.signupBonus > 0 && (
            <p className="text-sm text-center text-muted-foreground">
              +{success.signupBonus} welcome bonus
              {success.referralBonus > 0 && ` + ${success.referralBonus} referral bonus`}
            </p>
          )}
          <div className="bg-muted p-3 rounded-lg text-center">
            <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
            <p className="font-mono font-semibold text-lg">{success.referralCode}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Share with friends to earn bonus points
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Gift className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Join {programName}</CardTitle>
            <CardDescription>Earn points and unlock exclusive rewards</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {signupBonusPoints > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>{signupBonusPoints} welcome points</span>
            </div>
          )}
          {referralBonusPoints > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span>{referralBonusPoints} referral points</span>
            </div>
          )}
          {tiers.length > 1 && (
            <div className="flex items-center gap-2 text-sm col-span-2">
              <Gift className="h-4 w-4 text-primary" />
              <span>{tiers.length} tiers with increasing rewards</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="referralCode">Referral Code (optional)</Label>
            <Input
              id="referralCode"
              type="text"
              placeholder="ABC123XY"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              className="font-mono"
              maxLength={10}
            />
            {referralBonusPoints > 0 && (
              <p className="text-xs text-muted-foreground">
                Have a friend&apos;s code? Earn {referralBonusPoints} extra points!
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isEnrolling}>
            {isEnrolling ? 'Joining...' : 'Join Now'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default LoyaltyEnrollmentForm;
