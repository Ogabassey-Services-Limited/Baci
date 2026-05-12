'use client';

import type {
  MerchantTrustProfileReturnFee,
  MerchantTrustProfileReturnMethod,
  MerchantTrustProfileShippingFeeType,
} from '@baci/shared';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { type UseFormReturn, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import type { MerchantTrustProfileDraft } from '../../../../../../../packages/shared/src/contracts/merchant-trust-profile';
import { MerchantTrustProfileDraftSchema } from '../../../../../../../packages/shared/src/schemas/merchant-trust-profile';
import {
  TRUST_FIELD_CONFIGS,
  type TrustFieldConfig,
} from './trust-settings-fields';

interface TrustSettingsClientProps {
  initialTrustProfile: MerchantTrustProfileDraft | null;
}

interface TrustFormValues {
  foundedYear: string;
  whatsappNumber: string;
  supportHoursSummary: string;
  supportTimezone: string;
  supportResponseTimeSummary: string;
  returnPolicySummary: string;
  returnWindowDays: string;
  returnMethod: string;
  returnFees: string;
  shippingSummary: string;
  shippingRegions: string;
  handlingDaysMin: string;
  handlingDaysMax: string;
  transitDaysMin: string;
  transitDaysMax: string;
  shippingFeeType: string;
  warrantySummary: string;
}

type FieldName = keyof TrustFormValues;
const INTEGER_FIELD_NAMES: FieldName[] = [
  'foundedYear',
  'returnWindowDays',
  'handlingDaysMin',
  'handlingDaysMax',
  'transitDaysMin',
  'transitDaysMax',
];

function toInputString(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function normalizeString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return Number.NaN;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeEnum<T extends string>(value: string): T | null {
  const trimmed = value.trim();
  return trimmed ? (trimmed as T) : null;
}

function normalizeRegions(value: string): string[] | null {
  const regions = value
    .split(',')
    .map((region) => region.trim())
    .filter(Boolean);
  return regions.length > 0 ? regions : null;
}

function buildTrustProfile(values: TrustFormValues): MerchantTrustProfileDraft {
  return {
    founded_year: normalizeInteger(values.foundedYear),
    customer_service: {
      whatsapp_number: normalizeString(values.whatsappNumber),
      hours_summary: normalizeString(values.supportHoursSummary),
      timezone: normalizeString(values.supportTimezone),
      response_time_summary: normalizeString(values.supportResponseTimeSummary),
    },
    return_policy: {
      summary: normalizeString(values.returnPolicySummary),
      window_days: normalizeInteger(values.returnWindowDays),
      return_method: normalizeEnum<MerchantTrustProfileReturnMethod>(
        values.returnMethod
      ),
      return_fees: normalizeEnum<MerchantTrustProfileReturnFee>(
        values.returnFees
      ),
    },
    shipping_policy: {
      summary: normalizeString(values.shippingSummary),
      regions: normalizeRegions(values.shippingRegions),
      handling_days_min: normalizeInteger(values.handlingDaysMin),
      handling_days_max: normalizeInteger(values.handlingDaysMax),
      transit_days_min: normalizeInteger(values.transitDaysMin),
      transit_days_max: normalizeInteger(values.transitDaysMax),
      shipping_fee_type: normalizeEnum<MerchantTrustProfileShippingFeeType>(
        values.shippingFeeType
      ),
    },
    warranty_policy: {
      summary: normalizeString(values.warrantySummary),
    },
  };
}

function renderTrustField(
  form: UseFormReturn<TrustFormValues>,
  config: TrustFieldConfig
) {
  const id = `trust-${config.name}`;
  const fieldName = config.name as FieldName;
  const fieldError = form.formState.errors[fieldName];
  const fieldErrorId = fieldError ? `${id}-error` : undefined;

  if (config.kind === 'select') {
    return (
      <div key={config.name} className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {config.label}
        </label>
        <select
          id={id}
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...form.register(fieldName)}
        >
          {config.options?.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {fieldError?.message ? (
          <p
            id={fieldErrorId}
            className="text-sm text-destructive"
            role="alert"
          >
            {fieldError.message}
          </p>
        ) : null}
      </div>
    );
  }

  const commonProps = {
    id,
    placeholder: config.placeholder,
    ...form.register(fieldName),
  };

  return (
    <div key={config.name} className="grid gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {config.label}
      </label>
      {config.kind === 'textarea' ? (
        <Textarea
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          className="min-h-24"
          {...commonProps}
        />
      ) : (
        <Input
          aria-describedby={fieldErrorId}
          aria-errormessage={fieldErrorId}
          aria-invalid={fieldError ? 'true' : 'false'}
          type={config.type}
          {...commonProps}
        />
      )}
      {fieldError?.message ? (
        <p id={fieldErrorId} className="text-sm text-destructive" role="alert">
          {fieldError.message}
        </p>
      ) : null}
    </div>
  );
}

export function TrustSettingsClient({
  initialTrustProfile,
}: TrustSettingsClientProps) {
  const { toast } = useToast();
  const { updateMerchant } = useMerchant();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<TrustFormValues>({
    defaultValues: {
      foundedYear: toInputString(initialTrustProfile?.founded_year),
      whatsappNumber:
        initialTrustProfile?.customer_service?.whatsapp_number ?? '',
      supportHoursSummary:
        initialTrustProfile?.customer_service?.hours_summary ?? '',
      supportTimezone: initialTrustProfile?.customer_service?.timezone ?? '',
      supportResponseTimeSummary:
        initialTrustProfile?.customer_service?.response_time_summary ?? '',
      returnPolicySummary: initialTrustProfile?.return_policy?.summary ?? '',
      returnWindowDays: toInputString(
        initialTrustProfile?.return_policy?.window_days
      ),
      returnMethod: initialTrustProfile?.return_policy?.return_method ?? '',
      returnFees: initialTrustProfile?.return_policy?.return_fees ?? '',
      shippingSummary: initialTrustProfile?.shipping_policy?.summary ?? '',
      shippingRegions:
        initialTrustProfile?.shipping_policy?.regions?.join(', ') ?? '',
      handlingDaysMin: toInputString(
        initialTrustProfile?.shipping_policy?.handling_days_min
      ),
      handlingDaysMax: toInputString(
        initialTrustProfile?.shipping_policy?.handling_days_max
      ),
      transitDaysMin: toInputString(
        initialTrustProfile?.shipping_policy?.transit_days_min
      ),
      transitDaysMax: toInputString(
        initialTrustProfile?.shipping_policy?.transit_days_max
      ),
      shippingFeeType:
        initialTrustProfile?.shipping_policy?.shipping_fee_type ?? '',
      warrantySummary: initialTrustProfile?.warranty_policy?.summary ?? '',
    },
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

    const handlingMin = normalizeInteger(values.handlingDaysMin);
    const handlingMax = normalizeInteger(values.handlingDaysMax);
    if (
      handlingMin != null &&
      handlingMax != null &&
      !Number.isNaN(handlingMin) &&
      !Number.isNaN(handlingMax) &&
      handlingMin > handlingMax
    ) {
      form.setError('handlingDaysMax', {
        type: 'manual',
        message: 'Maximum must be greater than or equal to minimum',
      });
      hasErrors = true;
    }

    const transitMin = normalizeInteger(values.transitDaysMin);
    const transitMax = normalizeInteger(values.transitDaysMax);
    if (
      transitMin != null &&
      transitMax != null &&
      !Number.isNaN(transitMin) &&
      !Number.isNaN(transitMax) &&
      transitMin > transitMax
    ) {
      form.setError('transitDaysMax', {
        type: 'manual',
        message: 'Maximum must be greater than or equal to minimum',
      });
      hasErrors = true;
    }

    return hasErrors;
  };

  const onSubmit = async (values: TrustFormValues) => {
    form.clearErrors();
    setFormError(null);
    const hasIntegerErrors = applyIntegerFieldErrors(values);
    const hasRangeErrors = applyRangeErrors(values);
    if (hasIntegerErrors || hasRangeErrors) {
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
      await updateMerchant({ trust_profile: parsed.data });
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
            {TRUST_FIELD_CONFIGS.map((config) =>
              renderTrustField(form, config)
            )}
            <Button type="submit" className="sm:w-fit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Trust Settings
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
