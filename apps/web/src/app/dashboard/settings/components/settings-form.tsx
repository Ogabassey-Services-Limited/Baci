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
import { saveSettings } from './save-settings';
import { uploadLogoWithColors } from './settings-logo-upload';
import { buildSocialMediaDraft } from './settings-social-media-draft';
import { type SettingsFormValues, settingsSchema } from './settings-utils';
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
  return (
    <SettingsFormContents
      key={initialMerchant.id}
      initialMerchant={initialMerchant}
      initialBlogEnabled={initialBlogEnabled}
    />
  );
}

function SettingsFormContents({
  initialMerchant,
  initialBlogEnabled,
}: SettingsFormProps) {
  const { toast } = useToast();
  const { reloadMerchant, updateMerchant } = useMerchant();

  const [merchantState, setMerchantState] = useState(initialMerchant);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveGenerationRef = useRef(0);
  const [isUploading, setIsUploading] = useState(false);
  const [, startTransition] = useTransition();
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(
    initialMerchant?.hero_slides || []
  );
  const [heroSlidesEdited, setHeroSlidesEdited] = useState(false);

  // Latest social media values the user typed since the last merchant
  // refresh; null means "no edits yet" so submits fall back to the freshest
  // prop-derived values. (State instead of a ref: refs cannot be written
  // during the render-time sync below without bailing React Compiler out.)
  const [socialMediaEdits, setSocialMediaEdits] = useState<Record<
    string,
    string
  > | null>(null);

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

  useEffect(() => {
    return () => {
      saveGenerationRef.current += 1;
    };
  }, []);

  // Sync every prop-derived draft if the prop changes significantly — but
  // only when NO draft source holds unsaved edits (color mutations, RHF form
  // fields, hero slides, social media), so a background prop refresh can
  // never wipe in-progress work. Render-time prev-compare instead of an
  // effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const hasUnsavedDraftEdits =
    isDirty ||
    form.formState.isDirty ||
    socialMediaEdits !== null ||
    heroSlidesEdited;
  const [prevInitialMerchant, setPrevInitialMerchant] =
    useState(initialMerchant);
  const selectedMerchantChanged = initialMerchant.id !== prevInitialMerchant.id;
  if (
    initialMerchant &&
    initialMerchant !== prevInitialMerchant &&
    (selectedMerchantChanged || !hasUnsavedDraftEdits)
  ) {
    setPrevInitialMerchant(initialMerchant);
    setMerchantState(initialMerchant);
    setIsDirty(false);
    setHeroSlides(initialMerchant.hero_slides || []);
    setHeroSlidesEdited(false);
    setSocialMediaEdits(null);
    form.reset({
      business_name: initialMerchant.business_name || '',
      country: initialMerchant.country || 'NG',
    });
  }

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        void uploadLogoWithColors({
          dataUri: reader.result as string,
          previousState: merchantState,
          updateMerchant,
          toast,
          setMerchantState,
          setIsUploading,
          startTransition,
        });
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
    const saveGeneration = ++saveGenerationRef.current;
    await saveSettings({
      data,
      heroSlides,
      merchantId: initialMerchant.id,
      socialMedia: socialMediaEdits,
      updateMerchant,
      reloadMerchant,
      isCurrentSave: () => saveGeneration === saveGenerationRef.current,
      toast,
      setIsSaving,
    });
  }

  const brandColors = merchantState?.brand_colors ?? undefined;

  return (
    <Form {...form}>
      <form
        onSubmit={(event) => {
          // Defer the handleSubmit call to event time: building it during
          // render passes a ref-reading callback into a render-phase call,
          // which blocks React Compiler memoization.
          void form.handleSubmit(_onSubmit)(event);
        }}
        className="grid gap-6"
      >
        <BrandingCard
          merchantState={merchantState}
          brandColors={brandColors}
          isUploading={isUploading}
          onLogoUpload={handleLogoUpload}
          onColorChange={handleColorChange}
          onShuffleColors={handleShuffleColors}
        />

        <StoreFeaturesCard initialBlogEnabled={initialBlogEnabled} />

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

        <HeroCarouselCard
          slides={heroSlides}
          onSlidesChange={(slides) => {
            setHeroSlides(slides);
            setHeroSlidesEdited(true);
          }}
        />

        <SocialMediaCard
          initialSocialMedia={buildSocialMediaDraft(initialMerchant)}
          merchantId={initialMerchant.id}
          onSocialMediaChange={setSocialMediaEdits}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving && (
              <Loader2 className="mr-2 size-4 motion-safe:animate-spin" />
            )}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
