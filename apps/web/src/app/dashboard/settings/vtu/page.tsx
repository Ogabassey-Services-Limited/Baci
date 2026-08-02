'use client';

import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import { VtuSettingsContent } from './vtu-settings-content';

export default function VTUSettingsPage() {
  const { merchant, loading } = useMerchant();
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" role="status">
        <Loader2 className="size-8 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading VTU settings</span>
      </div>
    );
  }

  if (!merchant?.id) {
    return (
      <div className="space-y-6">
        <VtuSettingsHeading />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Merchant context is unavailable. Refresh and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <VtuSettingsContent merchantId={merchant.id} toast={toast} />;
}

function VtuSettingsHeading() {
  return <h1 className="text-3xl font-bold tracking-tight">VTU Services</h1>;
}
