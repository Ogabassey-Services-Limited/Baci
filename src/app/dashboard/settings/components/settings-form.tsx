'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import ColorThief from 'colorthief';
import {
  CheckCircle,
  Loader2,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
  Twitter,
  Upload,
} from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FaviconUpload } from '@/app/dashboard/settings/favicon-upload';
import { ColorPicker } from '@/components/color-picker';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { BrandColors } from '@/types';

extend([a11yPlugin]);

const settingsSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters.'),
  country: z.string().min(2, 'Please select a country.'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface HeroSlide {
  id: string;
  imageUrl: string;
  headline: string;
  description: string;
  cta: string;
}

const extractColorsFromImage = (imageDataUri: string): Promise<BrandColors> => {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.crossOrigin = 'Anonymous';
    img.src = imageDataUri;

    img.onload = () => {
      try {
        const colorThief = new ColorThief();
        const palette = colorThief.getPalette(img, 5);

        const toHex = (rgb: number[]) =>
          `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;

        const primaryRgb = palette[0] || [0, 0, 0];
        const accentRgb = palette[1] || primaryRgb;

        resolve({
          primary: toHex(primaryRgb),
          background: '#FFFFFF',
          accent: toHex(accentRgb),
        });
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => {
      reject(new Error('Image could not be loaded for color extraction.'));
    };
  });
};

interface SettingsFormProps {
  // biome-ignore lint/suspicious/noExplicitAny: Merchant type from Supabase query
  initialMerchant: any;
  initialBlogEnabled: boolean;
}

export function SettingsForm({
  initialMerchant,
  initialBlogEnabled,
}: SettingsFormProps) {
  const { toast } = useToast();
  // We still use useMerchant to get the `updateMerchant` function and keep context in sync,
  // but we initialize state from the passed prop to avoid LCP delay.
  const { updateMerchant } = useMerchant();

  // Local state initialized from props
  const [merchantState, setMerchantState] = useState(initialMerchant);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>(
    initialMerchant?.hero_slides || []
  );
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({
    twitter: initialMerchant?.social_media?.twitter || '',
    facebook: initialMerchant?.social_media?.facebook || '',
    instagram: initialMerchant?.social_media?.instagram || '',
    tiktok: initialMerchant?.social_media?.tiktok || '',
    youtube: initialMerchant?.social_media?.youtube || '',
    pinterest: initialMerchant?.social_media?.pinterest || '',
    linkedin: initialMerchant?.social_media?.linkedin || '',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );
  const [blogEnabled, setBlogEnabled] = useState(initialBlogEnabled);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Sync internal state if prop changes significantly (optional, but good for revalidation)
  useEffect(() => {
    if (initialMerchant) {
      setMerchantState(initialMerchant);
    }
  }, [initialMerchant]);

  // Ref to track pending autosave timeout for debouncing
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<Record<string, unknown> | null>(null);

  // Debounced autosave function to prevent race conditions
  const autoSave = useCallback(
    (data: { social_media?: Record<string, string> }) => {
      // Store latest data
      latestDataRef.current = data;

      // Clear any pending autosave
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Debounce: wait 500ms before saving
      autoSaveTimeoutRef.current = setTimeout(async () => {
        const dataToSave = latestDataRef.current;
        if (!dataToSave) return;

        setSaveStatus('saving');
        try {
          // We use the context update function to ensure global state stays in sync
          await updateMerchant(
            dataToSave as Parameters<typeof updateMerchant>[0],
            {
              skipReload: true,
            }
          );
          setSaveStatus('saved');
          // Reset to idle after 2 seconds
          setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (e) {
          logger.error({ error: e as Error, message: 'Autosave failed' });
          setSaveStatus('idle');
          toast({
            title: 'Autosave Failed',
            description: 'Changes could not be saved automatically.',
            variant: 'destructive',
          });
        }
      }, 500);
    },
    [updateMerchant, toast]
  );

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      business_name: initialMerchant?.business_name || '',
      country: initialMerchant?.country || 'NG',
    },
  });

  const handleBlogToggle = async (enabled: boolean) => {
    if (!merchantState?.id) return;

    // Optimistic update
    setBlogEnabled(enabled);
    setFeaturesLoading(true);

    try {
      const supabase = createClient();
      // Check if row exists first
      const { data: existing } = await supabase
        .from('merchant_feature_settings')
        .select('id')
        .eq('merchant_id', merchantState.id)
        .single();

      let error: { message: string } | null = null;

      if (existing) {
        const { error: updateError } = await supabase
          .from('merchant_feature_settings')
          .update({ blog_enabled: enabled })
          .eq('merchant_id', merchantState.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('merchant_feature_settings')
          .insert({
            merchant_id: merchantState.id,
            blog_enabled: enabled,
          });
        error = insertError;
      }

      if (error) throw error;

      toast({
        title: enabled ? 'Blog Enabled' : 'Blog Disabled',
        description: enabled
          ? 'Your blog is now public. Add posts to populate it.'
          : 'Your blog is now hidden from the storefront.',
      });
    } catch (error) {
      // Revert on error
      setBlogEnabled(!enabled);
      logger.error({
        error: error as Error,
        message: 'Failed to update blog setting',
      });
      toast({
        title: 'Update Failed',
        description: 'Could not update blog settings.',
        variant: 'destructive',
      });
    } finally {
      setFeaturesLoading(false);
    }
  };

  const handleHeroSlideChange = (
    index: number,
    field: keyof HeroSlide,
    value: string
  ) => {
    const newSlides = [...heroSlides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setHeroSlides(newSlides);
  };

  const handleHeroImageUpload = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        handleHeroSlideChange(index, 'imageUrl', dataUri); // Show preview immediately
        try {
          // Note: Use a dedicated bucket path in real implementation
          const uploadedUrl = await uploadImage(dataUri, 'hero-images');
          if (uploadedUrl) {
            handleHeroSlideChange(index, 'imageUrl', uploadedUrl);
          }
        } catch (_) {
          toast({
            title: 'Upload Failed',
            description: 'Could not upload hero image.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addHeroSlide = () => {
    setHeroSlides([
      ...heroSlides,
      {
        id: crypto.randomUUID(),
        imageUrl: '',
        headline: '',
        description: '',
        cta: '',
      },
    ]);
  };

  const removeHeroSlide = (index: number) => {
    setHeroSlides(heroSlides.filter((_, i) => i !== index));
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setIsUploading(true);
        try {
          // Optimistic UI update for logo
          // biome-ignore lint/suspicious/noExplicitAny: State callback typing
          setMerchantState((prev: any) => ({ ...prev, logo_url: dataUri }));

          const newColors = await extractColorsFromImage(dataUri);
          await updateMerchant({ logo_url: dataUri, brand_colors: newColors });

          // Update local state completely
          // biome-ignore lint/suspicious/noExplicitAny: State callback typing
          setMerchantState((prev: any) => ({
            ...prev,
            logo_url: dataUri,
            brand_colors: newColors,
          }));

          toast({
            title: 'Logo and Colors Updated!',
            description: 'Your new brand identity is saved.',
          });
        } catch (e) {
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

  const handleColorChange = (role: keyof BrandColors, newColor: string) => {
    if (merchantState?.brand_colors) {
      const updatedColors = { ...merchantState.brand_colors, [role]: newColor };
      // Optimistic update
      // biome-ignore lint/suspicious/noExplicitAny: State callback typing
      setMerchantState((prev: any) => ({
        ...prev,
        brand_colors: updatedColors,
      }));
      updateMerchant({ brand_colors: updatedColors });
    }
  };

  const handleShuffleColors = () => {
    if (!merchantState?.brand_colors) return;
    const { primary, background, accent } = merchantState.brand_colors;
    const remappedColors: BrandColors = {
      primary: accent,
      background: primary,
      accent: background,
    };
    // biome-ignore lint/suspicious/noExplicitAny: State callback typing
    setMerchantState((prev: any) => ({
      ...prev,
      brand_colors: remappedColors,
    }));
    updateMerchant({ brand_colors: remappedColors });
  };

  async function onSubmit(data: SettingsFormValues) {
    setIsSaving(true);
    try {
      await updateMerchant({
        ...data,
        hero_slides: heroSlides,
        social_media: socialMedia,
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

  const brandColors = merchantState?.brand_colors;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
        <Card className="glass">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>
              Manage your store's logo and color scheme.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label>Logo</Label>
              <div
                className={cn(
                  'relative border-2 border-dashed rounded-lg p-4 h-48 w-full flex flex-col items-center justify-center text-center transition-colors',
                  merchantState?.logo_url
                    ? 'border-green-500 bg-green-50/50'
                    : 'border-muted-foreground/50'
                )}
              >
                {merchantState?.logo_url ? (
                  <>
                    <Image
                      src={merchantState.logo_url}
                      alt="Uploaded Logo Preview"
                      fill
                      className="rounded-md p-2 object-contain"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload new logo
                    </p>
                  </>
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="w-8 h-8 motion-safe:animate-spin text-primary" />
                  </div>
                )}
                <Input
                  id="logo-upload"
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  aria-label="Upload logo file"
                  disabled={isUploading}
                />
              </div>
            </div>
            <div className="space-y-4">
              <Label>Brand Colors</Label>
              {brandColors ? (
                <div className="flex items-center gap-4">
                  <div className="flex gap-4">
                    {(['primary', 'background', 'accent'] as const).map(
                      (role) => (
                        <div
                          key={role}
                          className="flex flex-col items-center gap-1.5"
                        >
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                type="button"
                                className="w-12 h-12 rounded-full border-2 cursor-pointer relative group"
                                aria-label={`Edit ${role} color`}
                              >
                                <div
                                  className="w-full h-full rounded-full"
                                  style={{
                                    backgroundColor:
                                      brandColors[
                                        role as keyof typeof brandColors
                                      ],
                                  }}
                                />
                                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Pencil className="w-5 h-5 text-white" />
                                </div>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto">
                              <ColorPicker
                                color={
                                  brandColors[role as keyof typeof brandColors]
                                }
                                onChange={(newColor) =>
                                  handleColorChange(role, newColor)
                                }
                              />
                            </PopoverContent>
                          </Popover>
                          <span
                            className="text-xs font-medium capitalize h-4 block"
                            style={{
                              color:
                                brandColors[role as keyof typeof brandColors],
                            }}
                          >
                            {role}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleShuffleColors}
                    disabled={isUploading}
                    aria-label="Shuffle Colors"
                  >
                    <Shuffle className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Upload a logo to generate brand colors.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle>Store Features</CardTitle>
            <CardDescription>
              Enable or disable specific features for your storefront.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="blog-toggle"
                    className="text-base font-medium"
                  >
                    Blogging System
                  </Label>
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                    New
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Enable a SEO-friendly blog for your store. URLs will be
                  available at /blog.
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

        {/* Ad Unit: After Favicon */}
        <DashboardAdUnit variant="horizontal" />

        <Card className="glass">
          <CardHeader>
            <CardTitle>Hero Section Carousel</CardTitle>
            <CardDescription>
              Manage the slides for your storefronts hero section. Recommended
              size: 1920x1080px.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroSlides.map((slide, index) => (
              <Card key={slide.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="relative w-32 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted group">
                    {slide.imageUrl ? (
                      <Image
                        src={slide.imageUrl}
                        alt={`Slide ${index + 1}`}
                        width={128}
                        height={80}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Upload
                      </span>
                    )}
                    <Input
                      id={`hero-image-${index}`}
                      name={`hero-image-${index}`}
                      type="file"
                      accept="image/*"
                      // Explicitly set dimensions to cover container and be clickable
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      onChange={(e) => handleHeroImageUpload(index, e)}
                      aria-label={`Upload hero slide ${index + 1} image`}
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Headline"
                      value={slide.headline}
                      onChange={(e) =>
                        handleHeroSlideChange(index, 'headline', e.target.value)
                      }
                    />
                    <Input
                      placeholder="Description"
                      value={slide.description}
                      onChange={(e) =>
                        handleHeroSlideChange(
                          index,
                          'description',
                          e.target.value
                        )
                      }
                    />
                    <Input
                      placeholder="Button Text (e.g., Shop Now)"
                      value={slide.cta}
                      onChange={(e) =>
                        handleHeroSlideChange(index, 'cta', e.target.value)
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeHeroSlide(index)}
                    className="text-destructive"
                    aria-label={`Remove slide ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
            <Button type="button" variant="outline" onClick={addHeroSlide}>
              <Plus className="w-4 h-4 mr-2" /> Add Slide
            </Button>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Social Media</CardTitle>
              {saveStatus !== 'idle' && (
                <span
                  className={cn(
                    'text-xs font-medium flex items-center gap-1 transition-opacity',
                    saveStatus === 'saving'
                      ? 'text-muted-foreground'
                      : 'text-green-600'
                  )}
                >
                  {saveStatus === 'saving' ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3" /> Saved
                    </>
                  )}
                </span>
              )}
            </div>
            <CardDescription>
              Add your social media handles to improve your stores SEO and
              social sharing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="twitter" className="flex items-center gap-2">
                  <Twitter className="w-4 h-4" />
                  Twitter
                </Label>
                <Input
                  id="twitter"
                  placeholder="@username"
                  value={socialMedia.twitter}
                  onChange={(e) =>
                    setSocialMedia({
                      ...socialMedia,
                      twitter: e.target.value,
                    })
                  }
                  onBlur={() => autoSave({ social_media: socialMedia })}
                />
              </div>
              {/* Simplified for brevity (Add other social inputs as needed or keep simple) */}
            </div>
          </CardContent>
        </Card>

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
