'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiPatch } from '@/lib/api-client';
import { normalizeGooglePlaceId } from '@/lib/google-place-id-normalization';

interface GoogleReviewAuthoritySettingsCardProps {
  initialGooglePlaceId: string | null;
  initialGoogleReviewsEnabled: boolean;
  merchantId: string;
}

interface MerchantGoogleReviewSettings {
  google_place_id: string | null;
  google_reviews_enabled: boolean;
}

const googleReviewAuthoritySettingsSchema = z
  .object({
    google_place_id: z.string(),
    google_reviews_enabled: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (
      value.google_reviews_enabled &&
      !normalizeGooglePlaceId(value.google_place_id)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a valid Google Place ID.',
        path: ['google_place_id'],
      });
    }
  });

type GoogleReviewAuthoritySettingsFormValues = z.infer<
  typeof googleReviewAuthoritySettingsSchema
>;

export function GoogleReviewAuthoritySettingsCard({
  initialGooglePlaceId,
  initialGoogleReviewsEnabled,
  merchantId,
}: GoogleReviewAuthoritySettingsCardProps) {
  return (
    <GoogleReviewAuthoritySettingsForm
      key={merchantId}
      initialGooglePlaceId={initialGooglePlaceId}
      initialGoogleReviewsEnabled={initialGoogleReviewsEnabled}
      merchantId={merchantId}
    />
  );
}

function GoogleReviewAuthoritySettingsForm({
  initialGooglePlaceId,
  initialGoogleReviewsEnabled,
  merchantId,
}: GoogleReviewAuthoritySettingsCardProps) {
  const { toast } = useToast();
  const isActive = useRef(true);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm<GoogleReviewAuthoritySettingsFormValues>({
    defaultValues: {
      google_place_id: initialGooglePlaceId ?? '',
      google_reviews_enabled: initialGoogleReviewsEnabled,
    },
    resolver: zodResolver(googleReviewAuthoritySettingsSchema),
  });

  useLayoutEffect(() => {
    isActive.current = true;
    return () => {
      isActive.current = false;
    };
  }, []);

  // useWatch is React Compiler-compatible, unlike watch() which returns
  // interior-mutable values that would skip memoization for this component.
  const googleReviewsEnabled = useWatch({
    control,
    name: 'google_reviews_enabled',
  });
  const googlePlaceIdError = errors.google_place_id?.message;
  const rootError = errors.root?.message;

  const saveGoogleReviewSettings = async (
    values: GoogleReviewAuthoritySettingsFormValues
  ) => {
    const normalizedPlaceId = normalizeGooglePlaceId(values.google_place_id);

    try {
      await apiPatch<MerchantGoogleReviewSettings>('/api/merchant/features', {
        google_place_id: normalizedPlaceId,
        google_reviews_enabled: values.google_reviews_enabled,
        merchantId,
      });
      if (!isActive.current) return;

      toast({
        title: 'Google review authority saved',
        description: values.google_reviews_enabled
          ? 'Google reviews can now contribute merchant-level trust authority.'
          : 'Google reviews are no longer used for merchant-level trust authority.',
      });
    } catch {
      if (!isActive.current) return;

      setError('root', {
        message: 'Failed to save Google review settings.',
        type: 'server',
      });
      toast({
        title: 'Error',
        description: 'Failed to save Google review settings.',
        variant: 'destructive',
      });
    }
  };

  const googlePlaceIdErrorId = googlePlaceIdError
    ? 'google-place-id-error'
    : undefined;

  return (
    <Card className="glass" id="merchant-review-authority">
      <CardHeader>
        <CardTitle>Google Review Authority</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={handleSubmit(saveGoogleReviewSettings)}
        >
          <div className="flex flex-col gap-3 rounded-md border border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid gap-1">
              <label
                className="text-sm font-medium"
                htmlFor="google-reviews-enabled"
                id="google-reviews-enabled-label"
              >
                Use Google reviews for merchant trust
              </label>
              <p
                className="text-sm text-muted-foreground"
                id="google-reviews-enabled-description"
              >
                Connect a Google Business Profile place ID for the trust
                profile.
              </p>
            </div>
            <Controller
              control={control}
              name="google_reviews_enabled"
              render={({ field }) => (
                <Switch
                  aria-describedby="google-reviews-enabled-description"
                  aria-labelledby="google-reviews-enabled-label"
                  checked={field.value}
                  disabled={isSubmitting}
                  id="google-reviews-enabled"
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="google-place-id">
              Google Place ID
            </label>
            <Input
              aria-describedby={googlePlaceIdErrorId}
              aria-errormessage={googlePlaceIdErrorId}
              aria-invalid={googlePlaceIdError ? 'true' : 'false'}
              disabled={!googleReviewsEnabled || isSubmitting}
              id="google-place-id"
              placeholder="ChIJ..."
              {...register('google_place_id')}
            />
            {googlePlaceIdError ? (
              <p
                className="text-sm text-destructive"
                id={googlePlaceIdErrorId}
                role="alert"
              >
                {googlePlaceIdError}
              </p>
            ) : null}
          </div>

          {rootError ? (
            <p className="text-sm text-destructive" role="alert">
              {rootError}
            </p>
          ) : null}

          <Button className="sm:w-fit" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Save Google Reviews
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
