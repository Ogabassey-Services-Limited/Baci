'use client';

import mycoverai from '@mycoverai/mca-javascript-sdk';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Policy {
  id: string;
  policyNumber: string;
  provider: string;
  status: 'active' | 'expired' | 'pending';
  startDate: string;
  expiryDate: string;
  premium: number;
  coverage: number;
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic items data from API
  itemsInsured: any;
  claimStatus: string;
  certificateUrl?: string;
  customer_email?: string; // Added for SDK
}

export default function InsurancePolicyPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState('');

  const orderId = params.orderId as string;

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        const res = await fetch(`/api/insurance/policy/${orderId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to load policy');
        if (!data.found) {
          setError('No active insurance policy found for this order.');
        } else {
          const policy = data.policies?.[0] ?? null;
          if (!policy) {
            setError('No active insurance policy found for this order.');
          } else {
            setPolicy(policy);
          }
        }
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred'
        );
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchPolicy();
    }
  }, [orderId]);

  const handleFileClaim = () => {
    const publicKey = process.env.NEXT_PUBLIC_MYCOVER_PUBLIC_KEY;
    if (!publicKey) {
      alert(
        'Claims system is currently unavailable (Missing Configuration). Please contact support.'
      );
      return;
    }

    if (!policy?.itemsInsured?.product_id) {
      // Fallback if we didn't store simple product_id, try to use the one from env or show error
      // ideally we should have stored it, but env var is a safe fallback for the gadget product
      console.warn('Policy product_id missing, using default.');
    }

    // Initialize SDK
    mycoverai({
      action: 'claim',
      pk: publicKey,
      pid: [
        policy?.itemsInsured?.product_id ||
          process.env.NEXT_PUBLIC_MYCOVER_GADGET_PRODUCT_ID,
      ],
      policy_number: policy?.policyNumber, // Pass policy number if supported/required to pre-fill
      email: policy?.customer_email, // Pre-fill email
      onClose: () => {
        console.log('Claim modal closed');
      },
      // biome-ignore lint/suspicious/noExplicitAny: MyCover SDK callback response type
      callback: (response: any) => {
        console.log('Claim submitted', response);
        // Refresh policy status
        window.location.reload();
      },
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Policy Not Found</h2>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Standard Insurance Policy
        </h1>
        <p className="text-muted-foreground">
          Managed by MyCover.ai • Underwritten by {policy.provider}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">
              Policy Status
            </CardTitle>
            <CardDescription>{policy.policyNumber}</CardDescription>
          </div>
          <Badge
            variant={policy.status === 'active' ? 'default' : 'secondary'}
            className="text-sm"
          >
            {policy.status.toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Start Date
              </div>
              <div className="font-semibold">
                {new Date(policy.startDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Expiry Date
              </div>
              <div className="font-semibold">
                {new Date(policy.expiryDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Coverage Amount
              </div>
              <div className="font-semibold">
                ₦{policy.coverage.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Premium Paid
              </div>
              <div className="font-semibold">
                ₦{policy.premium.toLocaleString()}
              </div>
            </div>
          </div>

          <Separator className="my-2" />

          <div>
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Insured Item
            </div>
            <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/40">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              <span className="font-medium">
                {policy.itemsInsured?.product_name || 'Device'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">
                IMEI: {policy.itemsInsured?.imei}
              </span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-3 pt-4">
          {policy.certificateUrl && (
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2"
              asChild
            >
              <a
                href={policy.certificateUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="h-4 w-4" /> Download Certificate
              </a>
            </Button>
          )}

          <Button
            className="w-full sm:w-auto gap-2 ml-auto"
            onClick={handleFileClaim}
          >
            {/* Link to external claim portal or show modal */}
            <ExternalLink className="h-4 w-4" />
            File a Claim
          </Button>
        </CardFooter>
      </Card>

      <div className="rounded-lg border p-4 bg-muted/20">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> Important Information
        </h3>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Claims must be reported within 48 hours of the incident.</li>
          <li>
            Digital proof of purchase and ID may be required during the claim
            process.
          </li>
          <li>
            Screen damage and liquid damage are covered under this policy.
          </li>
        </ul>
      </div>
    </div>
  );
}
