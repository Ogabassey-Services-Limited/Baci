'use client';

import { AlertCircle, Loader2, Save } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING,
  getRecordValue,
  normalizeGoogleMerchantCenterId,
} from '@/components/analytics/google-store-widget-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { apiPatch } from '@/lib/api-client';
import type { MerchantFeatureSettingsInput } from '@/schemas/merchant-features';

const FEATURES_ENDPOINT = '/api/merchant/features';

interface GoogleMerchantCustomerReviewsCardProps {
  initialCustomSettings?: Record<string, unknown>;
}

function resolveInitialMerchantCenterId(
  customSettings: Record<string, unknown>
) {
  return (
    normalizeGoogleMerchantCenterId(
      customSettings[GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING]
    ) ?? ''
  );
}

export function GoogleMerchantCustomerReviewsCard({
  initialCustomSettings = {},
}: GoogleMerchantCustomerReviewsCardProps) {
  const { toast } = useToast();
  const [customSettings, setCustomSettings] = useState(initialCustomSettings);
  const [merchantCenterId, setMerchantCenterId] = useState(
    resolveInitialMerchantCenterId(initialCustomSettings)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveMerchantCenterId = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedMerchantCenterId = merchantCenterId.trim();
    const normalizedMerchantCenterId =
      trimmedMerchantCenterId.length > 0
        ? normalizeGoogleMerchantCenterId(trimmedMerchantCenterId)
        : null;

    if (trimmedMerchantCenterId.length > 0 && !normalizedMerchantCenterId) {
      setError('Enter the numeric Merchant Center ID from Google.');
      return;
    }

    const nextCustomSettings = { ...customSettings };

    if (normalizedMerchantCenterId) {
      nextCustomSettings[GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING] =
        normalizedMerchantCenterId;
    } else {
      delete nextCustomSettings[GOOGLE_MERCHANT_CENTER_ID_CUSTOM_SETTING];
    }

    setIsSaving(true);

    try {
      const updated = await apiPatch<
        Partial<Pick<MerchantFeatureSettingsInput, 'custom_settings'>>
      >(FEATURES_ENDPOINT, { custom_settings: nextCustomSettings });
      const updatedCustomSettings =
        getRecordValue(updated.custom_settings) ?? nextCustomSettings;

      setCustomSettings(updatedCustomSettings);
      setMerchantCenterId(
        resolveInitialMerchantCenterId(updatedCustomSettings)
      );
      toast({
        title: 'Merchant Center ID saved',
        description: normalizedMerchantCenterId
          ? 'Google Customer Reviews can now use this Merchant Center account.'
          : 'Google Customer Reviews opt-in is disabled until an ID is saved.',
      });
    } catch {
      setError('Failed to save Merchant Center ID.');
      toast({
        title: 'Error',
        description: 'Failed to save Merchant Center ID.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Google Customer Reviews</CardTitle>
        <CardDescription>
          Connect the order-confirmation survey opt-in and Google store widget.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          aria-label="Google Customer Reviews settings"
          className="grid gap-4"
          noValidate
          onSubmit={saveMerchantCenterId}
        >
          <div className="grid gap-2">
            <Label htmlFor="google-merchant-center-id">
              Merchant Center ID
            </Label>
            <Input
              aria-describedby={
                error ? 'google-merchant-center-id-error' : undefined
              }
              aria-errormessage={
                error ? 'google-merchant-center-id-error' : undefined
              }
              aria-invalid={error ? 'true' : 'false'}
              disabled={isSaving}
              id="google-merchant-center-id"
              inputMode="numeric"
              placeholder="112524323"
              value={merchantCenterId}
              onChange={(event) => setMerchantCenterId(event.target.value)}
            />
            {error ? (
              <p
                className="text-sm text-destructive"
                id="google-merchant-center-id-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <Alert role="note">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This ID is sent only on completed order pages so Google can show
              the Customer Reviews survey opt-in for eligible buyers.
            </AlertDescription>
          </Alert>

          <Button className="sm:w-fit" disabled={isSaving} type="submit">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Customer Reviews
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
