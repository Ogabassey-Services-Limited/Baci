'use client';

import { Copy, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

export function FeedUrlSection({
  id,
  label,
  description,
  feedUrl,
  platform,
}: FeedUrlSectionProps) {
  const { toast } = useToast();
  const [validating, setValidating] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(feedUrl);
    toast({
      title: 'Copied!',
      description: 'Feed URL copied to clipboard',
    });
  };

  const validateFeed = async () => {
    setValidating(true);
    try {
      const response = await fetch(feedUrl);
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
    } catch (error) {
      toast({
        title: 'Feed validation failed',
        description:
          error instanceof Error
            ? error.message
            : 'Could not connect to your product feed',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
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
        <Button variant="outline" size="icon" onClick={copyToClipboard}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={validateFeed}
          disabled={validating}
        >
          <RefreshCw
            className={`h-4 w-4 ${validating ? 'motion-safe:animate-spin' : ''}`}
          />
        </Button>
      </div>
    </div>
  );
}
