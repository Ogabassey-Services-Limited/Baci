'use client';

import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface KycData {
  nin: string;
  bvn: string;
  cac_number: string;
  kyc_status: 'pending' | 'verified' | 'rejected' | null;
}

export default function KycSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kycData, setKycData] = useState<KycData>({
    nin: '',
    bvn: '',
    cac_number: '',
    kyc_status: null,
  });

  useEffect(() => {
    const fetchKycData = async () => {
      try {
        const response = await fetch('/api/merchant/profile');
        if (response.ok) {
          const data = await response.json();
          setKycData({
            nin: data.nin || '',
            bvn: data.bvn || '',
            cac_number: data.cac_number || '',
            kyc_status: data.kyc_status,
          });
        }
      } catch (error) {
        console.error('Failed to fetch KYC data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchKycData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate at least one field is filled
    if (!kycData.nin && !kycData.bvn && !kycData.cac_number) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Please provide at least one verification document.',
      });
      return;
    }

    // Validate formats
    if (kycData.nin && !/^\d{11}$/.test(kycData.nin)) {
      toast({
        variant: 'destructive',
        title: 'Invalid NIN',
        description: 'NIN must be exactly 11 digits.',
      });
      return;
    }
    if (kycData.bvn && !/^\d{11}$/.test(kycData.bvn)) {
      toast({
        variant: 'destructive',
        title: 'Invalid BVN',
        description: 'BVN must be exactly 11 digits.',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/merchant/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nin: kycData.nin || null,
          bvn: kycData.bvn || null,
          cac_number: kycData.cac_number || null,
          kyc_status: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save KYC information');
      }

      toast({
        title: 'KYC Information Saved',
        description: 'Your verification details have been submitted.',
      });

      // Redirect back to dashboard with success indicator
      router.push('/dashboard?setup_complete=payments');
    } catch (error) {
      console.error('Failed to save KYC:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save KYC information. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusConfig = {
    pending: {
      icon: AlertCircle,
      label: 'Pending Review',
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    verified: {
      icon: CheckCircle2,
      label: 'Verified',
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    rejected: {
      icon: AlertCircle,
      label: 'Rejected',
      color: 'text-red-600 bg-red-50 border-red-200',
    },
  };

  const status = kycData.kyc_status ? statusConfig[kycData.kyc_status] : null;

  return (
    <div className="container max-w-2xl py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>Business Verification (KYC)</CardTitle>
              <CardDescription>
                Verify your identity to enable payment processing
              </CardDescription>
            </div>
          </div>

          {status && (
            <div
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border mt-4',
                status.color
              )}
            >
              <status.icon className="h-4 w-4" />
              <span className="text-sm font-medium">
                Status: {status.label}
              </span>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nin">
                  NIN (National Identification Number)
                </Label>
                <Input
                  id="nin"
                  name="nin"
                  value={kycData.nin}
                  onChange={(e) =>
                    setKycData((prev) => ({
                      ...prev,
                      nin: e.target.value.replace(/\D/g, '').slice(0, 11),
                    }))
                  }
                  placeholder="12345678901"
                  maxLength={11}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  Your 11-digit National Identification Number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bvn">BVN (Bank Verification Number)</Label>
                <Input
                  id="bvn"
                  name="bvn"
                  value={kycData.bvn}
                  onChange={(e) =>
                    setKycData((prev) => ({
                      ...prev,
                      bvn: e.target.value.replace(/\D/g, '').slice(0, 11),
                    }))
                  }
                  placeholder="22123456789"
                  maxLength={11}
                  inputMode="numeric"
                />
                <p className="text-xs text-muted-foreground">
                  Your 11-digit Bank Verification Number
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cac_number">CAC Registration Number</Label>
                <Input
                  id="cac_number"
                  name="cac_number"
                  value={kycData.cac_number}
                  onChange={(e) =>
                    setKycData((prev) => ({
                      ...prev,
                      cac_number: e.target.value,
                    }))
                  }
                  placeholder="RC 1234567 or BN 1234567"
                />
                <p className="text-xs text-muted-foreground">
                  Your Corporate Affairs Commission registration number
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save KYC Information'
                )}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Your information is encrypted and securely stored. We only use it
              for payment verification purposes.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
