'use client';

import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useVtuSettings } from './use-vtu-settings';
import { VtuCommissionCard } from './vtu-commission-card';
import { VtuCustomerOptionsCards } from './vtu-customer-options-cards';
import { VtuServiceCard } from './vtu-service-card';

interface VtuSettingsContentProps {
  merchantId: string | undefined;
  toast: Parameters<typeof useVtuSettings>[1];
}

export function VtuSettingsContent({
  merchantId,
  toast,
}: VtuSettingsContentProps) {
  const {
    addAmount,
    loadError,
    loading,
    newAmount,
    removeAmount,
    retryLoad,
    save,
    saving,
    setNewAmount,
    setSettings,
    settings,
  } = useVtuSettings(merchantId, toast);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <VtuPageIntro />
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              {loadError}
            </p>
            <Button
              className="mt-3"
              onClick={retryLoad}
              size="sm"
              variant="outline"
            >
              <RefreshCw className="size-4 mr-1.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <VtuPageIntro />
      <VtuServiceCard settings={settings} setSettings={setSettings} />
      <VtuCustomerOptionsCards
        addAmount={addAmount}
        newAmount={newAmount}
        removeAmount={removeAmount}
        setNewAmount={setNewAmount}
        setSettings={setSettings}
        settings={settings}
      />
      <VtuCommissionCard
        commissionRate={settings.vtu_merchant_commission_rate}
      />
      <div className="flex justify-end">
        <Button disabled={saving} onClick={save}>
          {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function VtuPageIntro() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">VTU Services</h1>
      <p className="text-muted-foreground">
        Enable airtime and data purchases for your customers. Earn commission on
        every sale.
      </p>
    </div>
  );
}
