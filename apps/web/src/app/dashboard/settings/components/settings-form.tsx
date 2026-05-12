'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { FaviconUpload } from '@/app/dashboard/settings/favicon-upload';
import { DashboardAdUnit } from '@/components/dashboard/dashboard-ad-unit';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useMerchant } from '@/hooks/use-merchant-client';
import { useToast } from '@/hooks/use-toast';
import type { CachedMerchant, HeroSlide } from '@/lib/cached-data';
import { logger } from '@/lib/logger';
import type { BrandColors } from '@/types';
import { BrandingCard } from './branding-card';
import { HeroCarouselCard } from './hero-carousel-card';
import {
  extractColorsFromImage,
  type SettingsFormValues,
  sanitizeSocialMedia,
  settingsSchema,
} from './settings-utils';
import { SocialMediaCard } from './social-media-card';
import { StoreFeaturesCard } from './store-features-card';

extend([a11yPlugin]);

interface SettingsFormProps {
  initialMerchant: CachedMerchant;
  initialBlogEnabled: boolean;
}

export function SettingsForm({
  initialMerchant,
  initialBlogEnabled,
}: SettingsFormProps) {
  const { toast } = useToast();
  const { updateMerchant } = useMerchant();

  const [merchantState, setMerchantState] = useState(initialMerchant);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(
    initialMerchant?.hero_slides || []
  );

  // Ref to capture latest social media values for form submit
  const socialMediaRef = useRef<Record<string, string>>({
    twitter: initialMerchant?.social_media?.twitter || '',
    facebook: initialMerchant?.social_media?.facebook || '',
    instagram: initialMerchant?.social_media?.instagram || '',
    tiktok: initialMerchant?.social_media?.tiktok || '',
    youtube: initialMerchant?.social_media?.youtube || '',
    pinterest: initialMerchant?.social_media?.pinterest || '',
    linkedin: initialMerchant?.social_media?.linkedin || '',
    snapchat: initialMerchant?.social_media?.snapchat || '',
  });

  // Sync internal state if prop changes significantly (only if not dirty to prevent data loss)
  useEffect(() => {
    if (initialMerchant && !isDirty) {
      setMerchantState(initialMerchant);
    }
  }, [initialMerchant, isDirty]);

  const form = useForm<
    z.input<typeof settingsSchema>,
    unknown,
    SettingsFormValues
  >({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      business_name: initialMerchant?.business_name || '',
      country: initialMerchant?.country || 'NG',
    },
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setIsUploading(true);
        const previousState = merchantState;
        try {
          startTransition(() => {
            setMerchantState((prev) =>
              prev ? { ...prev, logo_url: dataUri } : prev
            );
          });

          const newColors = await extractColorsFromImage(dataUri);

          // Upload to storage instead of storing data URI in DB
          const { uploadImage } = await import('@/lib/storage');
          const uploadedUrl = await uploadImage(dataUri);

          if (!uploadedUrl)
            throw new Error('Failed to upload logo to storage.');

          await updateMerchant({
            logo_url: uploadedUrl,
            brand_colors: newColors,
          });

          // Update local state with the final public URL
          startTransition(() => {
            setMerchantState((prev) =>
              prev
                ? {
                    ...prev,
                    logo_url: uploadedUrl,
                    brand_colors: newColors,
                  }
                : prev
            );
          });

          toast({
            title: 'Logo and Colors Updated!',
            description: 'Your new brand identity is saved.',
          });
        } catch (e) {
          setMerchantState(previousState);
          logger.error({
            error: e as Error,
            message: 'Logo upload and color extraction failed.',
          });
          toast({
            title: 'Update Failed',
            description: (e as Error).message,
            variant: 'destructive',
          });
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = async (
    role: keyof BrandColors,
    newColor: string
  ) => {
    if (merchantState?.brand_colors) {
      const updatedColors = { ...merchantState.brand_colors, [role]: newColor };

      startTransition(() => {
        setMerchantState((prev) =>
          prev
            ? {
                ...prev,
                brand_colors: updatedColors,
              }
            : prev
        );
      });

      setIsDirty(true);
      try {
        await updateMerchant({ brand_colors: updatedColors });
        setIsDirty(false);
      } catch (e) {
        logger.error({ error: e as Error, message: 'Color update failed' });
        toast({
          title: 'Color Update Failed',
          description: 'Could not save color changes.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleShuffleColors = async () => {
    if (!merchantState?.brand_colors) return;
    const { primary, background, accent } = merchantState.brand_colors;
    const remappedColors: BrandColors = {
      primary: accent,
      background: primary,
      accent: background,
    };
    startTransition(() => {
      setMerchantState((prev) =>
        prev
          ? {
              ...prev,
              brand_colors: remappedColors,
            }
          : prev
      );
    });
    setIsDirty(true);
    try {
      await updateMerchant({ brand_colors: remappedColors });
      setIsDirty(false);
    } catch (e) {
      logger.error({ error: e as Error, message: 'Shuffle colors failed' });
      toast({
        title: 'Color Update Failed',
        description: 'Could not save shuffled colors.',
        variant: 'destructive',
      });
    }
  };

  async function _onSubmit(data: SettingsFormValues) {
    setIsSaving(true);
    try {
      await updateMerchant({
        ...data,
        hero_slides: heroSlides,
        social_media: sanitizeSocialMedia(socialMediaRef.current),
      } as Parameters<typeof updateMerchant>[0]);
      toast({
        title: 'Settings Saved!',
        description: 'Your store settings have been updated.',
      });
    } catch (e) {
      toast({
        title: 'Error Saving Settings',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  const brandColors = merchantState?.brand_colors ?? undefined;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(_onSubmit)} className="grid gap-6">
        <BrandingCard
          merchantState={merchantState}
          brandColors={brandColors}
          isUploading={isUploading}
          onLogoUpload={handleLogoUpload}
          onColorChange={handleColorChange}
          onShuffleColors={handleShuffleColors}
        />

        <StoreFeaturesCard
          merchantId={merchantState.id}
          initialBlogEnabled={initialBlogEnabled}
        />

        <Card className="glass">
          <CardHeader>
            <CardTitle>Favicon</CardTitle>
            <CardDescription>
              Upload a custom favicon for your storefront browser tabs and
              bookmarks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FaviconUpload />
          </CardContent>
        </Card>

        <DashboardAdUnit variant="horizontal" />

        <HeroCarouselCard slides={heroSlides} onSlidesChange={setHeroSlides} />

        <SocialMediaCard
          initialSocialMedia={{
            twitter: initialMerchant?.social_media?.twitter || '',
            facebook: initialMerchant?.social_media?.facebook || '',
            instagram: initialMerchant?.social_media?.instagram || '',
            tiktok: initialMerchant?.social_media?.tiktok || '',
            youtube: initialMerchant?.social_media?.youtube || '',
            pinterest: initialMerchant?.social_media?.pinterest || '',
            linkedin: initialMerchant?.social_media?.linkedin || '',
            snapchat: initialMerchant?.social_media?.snapchat || '',
          }}
          updateMerchant={updateMerchant}
          onSocialMediaChange={(sm) => {
            socialMediaRef.current = sm;
          }}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && (
              <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
