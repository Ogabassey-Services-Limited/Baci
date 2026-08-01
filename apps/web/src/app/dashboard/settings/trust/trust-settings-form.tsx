'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import type { MerchantTrustProfileDraft } from '../../../../../../../packages/shared/src/contracts/merchant-trust-profile';
import { MerchantTrustProfileDraftSchema } from '../../../../../../../packages/shared/src/schemas/merchant-trust-profile';
import { TrustSettingsField } from './trust-settings-field';
import { TRUST_FIELD_CONFIGS } from './trust-settings-fields';
import {
  buildTrustProfile,
  createTrustFormValues,
  INTEGER_FIELD_NAMES,
  normalizeInteger,
  type TrustFormValues,
} from './trust-settings-form-data';

interface TrustSettingsFormProps {
  merchantId: string;
  initialTrustProfile: MerchantTrustProfileDraft | null;
}

export function TrustSettingsForm({
  merchantId,
  initialTrustProfile,
}: TrustSettingsFormProps) {
  const { toast } = useToast();
  const { updateMerchant } = useMerchant();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<TrustFormValues>({
    defaultValues: createTrustFormValues(initialTrustProfile),
  });

  const applyIntegerFieldErrors = (values: TrustFormValues) => {
    let hasErrors = false;
    for (const fieldName of INTEGER_FIELD_NAMES) {
      const value = values[fieldName].trim();
      if (value && !/^\d+$/.test(value)) {
        form.setError(fieldName, {
          type: 'manual',
          message: 'Enter a whole number',
        });
        hasErrors = true;
      }
    }
    return hasErrors;
  };

  const applyRangeErrors = (values: TrustFormValues) => {
    let hasErrors = false;
    const ranges: [
      TrustFormValues[keyof TrustFormValues],
      TrustFormValues[keyof TrustFormValues],
      'handlingDaysMax' | 'transitDaysMax',
    ][] = [
      [values.handlingDaysMin, values.handlingDaysMax, 'handlingDaysMax'],
      [values.transitDaysMin, values.transitDaysMax, 'transitDaysMax'],
    ];
    for (const [minimumValue, maximumValue, errorField] of ranges) {
      const minimum = normalizeInteger(minimumValue);
      const maximum = normalizeInteger(maximumValue);
      if (
        minimum != null &&
        maximum != null &&
        !Number.isNaN(minimum) &&
        !Number.isNaN(maximum) &&
        minimum > maximum
      ) {
        form.setError(errorField, {
          type: 'manual',
          message: 'Maximum must be greater than or equal to minimum',
        });
        hasErrors = true;
      }
    }
    return hasErrors;
  };

  const onSubmit = async (values: TrustFormValues) => {
    form.clearErrors();
    setFormError(null);
    if (applyIntegerFieldErrors(values) || applyRangeErrors(values)) {
      setFormError('Review the fields below and fix any invalid values.');
      return;
    }
    const parsed = MerchantTrustProfileDraftSchema.safeParse(
      buildTrustProfile(values)
    );
    if (!parsed.success) {
      applyIntegerFieldErrors(values);
      setFormError('Review the fields below and fix any invalid values.');
      return;
    }
    setIsSaving(true);
    try {
      await updateMerchant(
        { trust_profile: parsed.data },
        { merchantId, skipReload: true }
      );
      toast({
        title: 'Trust settings saved',
        description: 'Your trust and policy details have been updated.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to save trust settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Button variant="outline" asChild className="justify-start">
          <Link href="/dashboard/settings">Contact Basics</Link>
        </Button>
        <Button variant="outline" asChild className="justify-start">
          <Link href="/dashboard/pages">Content Pages</Link>
        </Button>
        <Button variant="outline" asChild className="justify-start">
          <Link href="/dashboard/settings/tax">Legal Identity</Link>
        </Button>
      </div>
      <Card className="glass">
        <CardHeader>
          <CardTitle>Trust Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="grid gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {formError ? (
              <div
                className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
                role="alert"
              >
                {formError}
              </div>
            ) : null}
            {TRUST_FIELD_CONFIGS.map((config) => (
              <TrustSettingsField
                key={config.name}
                form={form}
                config={config}
              />
            ))}
            <Button type="submit" className="sm:w-fit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Save Trust Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
