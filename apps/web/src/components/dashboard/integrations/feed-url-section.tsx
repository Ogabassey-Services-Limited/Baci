'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface FeedUrlSectionProps {
  id: string;
  label: string;
  description: string;
  feedUrl: string;
  platform: string;
}

// Validate that URL is safe to fetch (same-origin or trusted domains)
function isValidFeedUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    // Only allow same-origin URLs or our own API endpoints
    // This prevents SSRF attacks from fetching arbitrary external URLs
    if (parsedUrl.origin === window.location.origin) {
      return true;
    }
    // Allow fetching from our known feed domains
    const trustedDomains = ['usebaci.com', 'www.usebaci.com'];
    return trustedDomains.some(
      (domain) =>
        parsedUrl.hostname === domain ||
        parsedUrl.hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function FeedUrlSection({
  id,
  label,
  description,
  feedUrl,
  platform,
}: FeedUrlSectionProps) {
  const { toast } = useToast();
  const [validating, setValidating] = useState(false);

  const validateFeed = () => {
    // Security: Validate URL before fetching to prevent SSRF
    if (!isValidFeedUrl(feedUrl)) {
      toast({
        title: 'Invalid feed URL',
        description: 'The feed URL is not from a trusted source',
        variant: 'destructive',
      });
      return;
    }

    setValidating(true);
    // nosemgrep: typescript.react.security.audit.react-ssrf.react-ssrf
    // Safe: URL validated via isValidFeedUrl() - only allows same-origin or trusted domain (usebaci.com)
    fetch(feedUrl)
      .then((response) => {
        if (response.ok) {
          toast({
            title: 'Feed is valid!',
            description: `Your ${platform} product feed is working correctly`,
          });
        } else {
          toast({
            title: 'Feed validation failed',
            description: 'There was an error fetching your product feed',
            variant: 'destructive',
          });
        }
      })
      .catch((error: unknown) => {
        toast({
          title: 'Feed validation failed',
          description:
            error instanceof Error
              ? error.message
              : 'Could not connect to your product feed',
          variant: 'destructive',
        });
      })
      .finally(() => {
        setValidating(false);
      });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={id} className="text-base font-semibold">
          {label}
        </Label>
        <p className="text-sm text-muted-foreground mb-2">{description}</p>
      </div>

      <div className="flex gap-2">
        <Input id={id} value={feedUrl} readOnly className="font-mono text-sm" />
        <CopyButton
          value={feedUrl}
          label="Copy feed URL"
          successLabel="Copied!"
          variant="outline"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={validateFeed}
          disabled={validating}
          aria-label="Validate feed URL"
        >
          <RefreshCw
            className={`h-4 w-4 ${validating ? 'motion-safe:animate-spin' : ''}`}
          />
        </Button>
      </div>
    </div>
  );
}
