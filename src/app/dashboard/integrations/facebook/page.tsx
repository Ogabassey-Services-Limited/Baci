'use client';

import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { FeedUrlSection } from '@/components/dashboard/integrations/feed-url-section';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

export default function FacebookIntegrationPage() {
  const { merchant } = useMerchant();

  if (!merchant) {
    return <div>Loading...</div>;
  }

  const baseUrl = merchant.custom_domain
    ? `https://${merchant.custom_domain}`
    : `https://${merchant.slug}.baci.app`;

  const feedUrl = `${baseUrl}/api/feed/facebook?merchant_slug=${merchant.slug}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={asRoute('/dashboard/integrations')}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Facebook & Instagram Shopping
          </h1>
          <p className="text-muted-foreground">
            Sell products directly on Facebook and Instagram
          </p>
        </div>
      </div>

      <Card className="glass">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Product Catalog Configuration</CardTitle>
              <CardDescription>
                Connect your store to Facebook Commerce Manager
              </CardDescription>
            </div>
            <svg
              className="h-8 w-8 text-blue-600"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Facebook Shops and Instagram Shopping let customers browse and
              purchase products directly on social media. Reach billions of
              users and enable seamless checkout experiences.
            </AlertDescription>
          </Alert>

          <FeedUrlSection
            id="facebook-feed-url"
            label="Your Product Catalog Feed URL"
            description="Use this feed in Facebook Commerce Manager"
            feedUrl={feedUrl}
            platform="Facebook"
          />

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-sm">Setup Instructions:</h4>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>
                Go to{' '}
                <a
                  href="https://business.facebook.com/commerce"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Facebook Commerce Manager
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                Click <strong>Catalog</strong> in the left menu
              </li>
              <li>
                Click <strong>Add Items</strong> →{' '}
                <strong>Use Data Feed</strong>
              </li>
              <li>
                Choose <strong>Scheduled fetch</strong>
              </li>
              <li>Paste your feed URL from above</li>
              <li>
                Set schedule to <strong>Daily</strong>
              </li>
              <li>
                Click <strong>Upload</strong>
              </li>
            </ol>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Tip:</strong> Once your catalog is set up, you can enable
              Instagram Shopping by connecting your Instagram Business account
              to your Facebook Page and Commerce Manager.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
