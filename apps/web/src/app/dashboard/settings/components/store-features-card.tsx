'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiPatch } from '@/lib/api-client';
import { logger } from '@/lib/logger';

interface StoreFeaturesCardProps {
  initialBlogEnabled: boolean;
  merchantId: string;
}

type ToastFn = ReturnType<typeof useToast>['toast'];

// Module-scope helper keeps the try/finally out of the component body
// (React Compiler cannot lower try/finally inside components yet).
async function persistBlogEnabled({
  enabled,
  merchantId,
  toast,
  setBlogEnabled,
  setFeaturesLoading,
  isRequestCurrent,
}: {
  enabled: boolean;
  merchantId: string;
  toast: ToastFn;
  setBlogEnabled: (enabled: boolean) => void;
  setFeaturesLoading: (loading: boolean) => void;
  isRequestCurrent: () => boolean;
}): Promise<void> {
  try {
    await apiPatch('/api/merchant/features', {
      blog_enabled: enabled,
      merchantId,
    });

    if (!isRequestCurrent()) return;

    toast({
      title: enabled ? 'Blog Enabled' : 'Blog Disabled',
      description: enabled
        ? 'Your blog is now public. Add posts to populate it.'
        : 'Your blog is now hidden from the storefront.',
    });
  } catch (error) {
    if (!isRequestCurrent()) return;

    setBlogEnabled(!enabled);
    logger.error({
      error: error instanceof Error ? error : new Error(String(error)),
      message: 'Failed to update blog setting',
    });
    toast({
      title: 'Update Failed',
      description: 'Could not update blog settings.',
      variant: 'destructive',
    });
  } finally {
    if (isRequestCurrent()) setFeaturesLoading(false);
  }
}

export function StoreFeaturesCard({
  initialBlogEnabled,
  merchantId,
}: StoreFeaturesCardProps) {
  const { toast } = useToast();
  const [blogEnabled, setBlogEnabled] = useState(initialBlogEnabled);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const activeMerchantIdRef = useRef(merchantId);
  const merchantGenerationRef = useRef(0);
  const isMountedRef = useRef(true);

  useLayoutEffect(() => {
    isMountedRef.current = true;
    if (activeMerchantIdRef.current !== merchantId) {
      merchantGenerationRef.current += 1;
    }
    activeMerchantIdRef.current = merchantId;
    setBlogEnabled(initialBlogEnabled);
    setFeaturesLoading(false);
    return () => {
      isMountedRef.current = false;
    };
  }, [initialBlogEnabled, merchantId]);

  const handleBlogToggle = (enabled: boolean) => {
    const requestMerchantId = merchantId;
    const requestMerchantGeneration = merchantGenerationRef.current;
    setBlogEnabled(enabled);
    setFeaturesLoading(true);

    return persistBlogEnabled({
      enabled,
      merchantId,
      toast,
      setBlogEnabled,
      setFeaturesLoading,
      isRequestCurrent: () =>
        isMountedRef.current &&
        activeMerchantIdRef.current === requestMerchantId &&
        merchantGenerationRef.current === requestMerchantGeneration,
    });
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Store Features</CardTitle>
        <CardDescription>
          Enable or disable specific features for your storefront.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-x-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="blog-toggle" className="text-base font-medium">
                Blogging System
              </Label>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                New
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Enable a SEO-friendly blog for your store. URLs will be available
              at /blog.
            </p>
          </div>
          <Switch
            id="blog-toggle"
            checked={blogEnabled}
            onCheckedChange={handleBlogToggle}
            disabled={featuresLoading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
