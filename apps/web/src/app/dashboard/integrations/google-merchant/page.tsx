'use client';

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { FeedUrlSection } from '@/components/dashboard/integrations/feed-url-section';
import { GoogleMerchantReadinessCard } from '@/components/dashboard/integrations/google-merchant-readiness-card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant-client';
import { asRoute } from '@/lib/routes';

export default function GoogleMerchantPage() {
  const { merchant } = useMerchant();

  if (!merchant) {
    return <div>Loading...</div>;
  }

  const baseUrl = merchant.custom_domain
    ? `https://${merchant.custom_domain}`
    : `https://${merchant.slug}.baci.app`;

  const feedUrl = `${baseUrl}/api/feed/google-merchant?merchant_slug=${merchant.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          asChild
          aria-label="Back to integrations"
        >
          <Link href={asRoute('/dashboard/integrations')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Google Merchant Center
          </h1>
          <p className="text-muted-foreground">
            Sync your products to Google Shopping
          </p>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                Product Feed Configuration
              </CardTitle>
              <CardDescription>
                Sync your products to Google Shopping and run product ads
              </CardDescription>
            </div>
            <Image
              src="https://www.gstatic.com/images/branding/product/1x/googleg_32dp.png"
              alt="Google"
              width={32}
              height={32}
              className="h-8 w-8"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>What is Google Merchant Center?</strong>
              <br />
              It allows your products to appear in Google Shopping results and
              run Shopping ads. Customers can see your product images, prices,
              and stock status directly in Google search.
            </AlertDescription>
          </Alert>

          <FeedUrlSection
            id="feed-url"
            label="Your Product Feed URL"
            description="Copy this URL and paste it in Google Merchant Center"
            feedUrl={feedUrl}
            platform="Google Merchant"
          />

          <GoogleMerchantReadinessCard />

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Setup Instructions:</h4>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>
                Go to{' '}
                <a
                  href="https://merchants.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Google Merchant Center
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                and sign in with your Google account
              </li>
              <li>
                Click on <strong>Products</strong> in the left menu
              </li>
              <li>
                Click on <strong>Feeds</strong>
              </li>
              <li>
                Click the <strong>+</strong> button to add a new feed
              </li>
              <li>
                Select your <strong>Country of sale</strong> and{' '}
                <strong>Language</strong>
              </li>
              <li>
                Choose <strong>"Scheduled fetch"</strong> as the input method
              </li>
              <li>Paste your feed URL from above</li>
              <li>
                Set fetch frequency to <strong>"Daily"</strong>
              </li>
              <li>
                Click <strong>Create feed</strong>
              </li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> After setting up the feed in Google
              Merchant Center, it may take 3-5 days for Google to review and
              approve your products. Make sure your products have proper titles,
              descriptions, images, and GTINs (if applicable).
            </AlertDescription>
          </Alert>

          <div className="pt-4 border-t">
            <h4 className="font-semibold text-sm mb-3">Feed includes:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Product titles & descriptions
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Pricing & availability
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Product images
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Brand & condition
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                GTINs & MPNs
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Shipping weights
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
