
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { useMerchant } from '@/hooks/use-merchant';
import { COUNTRIES } from '@/lib/countries';
import { useEffect, useState } from 'react';
import { Loader2, Upload, CheckCircle, Pencil, Shuffle, Trash2, Plus, Twitter, Facebook, Instagram, Users, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import ColorThief from 'colorthief';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import { ColorPicker } from '@/components/color-picker';
import type { BrandColors } from '@/types';
import { cn } from '@/lib/utils';
import { uploadImage } from '@/lib/storage';
import Link from 'next/link';
import { SetupInstructions } from '@/components/analytics/setup-instructions';
import { FaviconUpload } from './favicon-upload';

extend([a11yPlugin]);

const settingsSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters.'),
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

        const toHex = (rgb: number[]) => `#${rgb.map(c => c.toString(16).padStart(2, '0')).join('')}`;

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


export default function SettingsPage() {
  const { toast } = useToast();
  const { merchant, loading, updateMerchant } = useMerchant();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [socialMedia, setSocialMedia] = useState<Record<string, string>>({
    twitter: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    pinterest: '',
    linkedin: '',
  });
  const [analyticsSettings, setAnalyticsSettings] = useState({
    google_analytics_id: '',
    ga4_api_secret: '',
    facebook_pixel_id: '',
    facebook_capi_token: '',
    tiktok_pixel_id: '',
    tiktok_access_token: '',
    snapchat_pixel_id: '',
    snapchat_capi_token: '',
    twitter_pixel_id: '',
  });

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      business_name: '',
      country: 'NG', // Default to Nigeria
    },
  });

  useEffect(() => {
    if (merchant) {
      form.reset({
        business_name: merchant.business_name || '',
        country: merchant.country || 'NG',
      });
      // @ts-expect-error - hero_slides might not be on the type yet
      setHeroSlides(merchant.hero_slides || []);
      const merchantData = merchant as unknown as Record<string, unknown>;
      const socialMedia = merchantData.social_media as Record<string, unknown> | undefined;
      setSocialMedia({
        twitter: (socialMedia?.twitter as string) || '',
        facebook: (socialMedia?.facebook as string) || '',
        instagram: (socialMedia?.instagram as string) || '',
        tiktok: (socialMedia?.tiktok as string) || '',
        youtube: (socialMedia?.youtube as string) || '',
        pinterest: (socialMedia?.pinterest as string) || '',
        linkedin: (socialMedia?.linkedin as string) || '',
      });
      setAnalyticsSettings({
        google_analytics_id: (merchantData.google_analytics_id as string) || '',
        ga4_api_secret: (merchantData.ga4_api_secret as string) || '',
        facebook_pixel_id: (merchantData.facebook_pixel_id as string) || '',
        facebook_capi_token: (merchantData.facebook_capi_token as string) || '',
        tiktok_pixel_id: (merchantData.tiktok_pixel_id as string) || '',
        tiktok_access_token: (merchantData.tiktok_access_token as string) || '',
        snapchat_pixel_id: (merchantData.snapchat_pixel_id as string) || '',
        snapchat_capi_token: (merchantData.snapchat_capi_token as string) || '',
        twitter_pixel_id: (merchantData.twitter_pixel_id as string) || '',
      });
    }
  }, [merchant, form]);

  const handleHeroSlideChange = (index: number, field: keyof HeroSlide, value: string) => {
    const newSlides = [...heroSlides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setHeroSlides(newSlides);
  };

  const handleHeroImageUpload = async (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        handleHeroSlideChange(index, 'imageUrl', dataUri); // Show preview immediately
        try {
          const uploadedUrl = await uploadImage(dataUri, 'hero-images');
          if (uploadedUrl) {
            handleHeroSlideChange(index, 'imageUrl', uploadedUrl);
          }
        } catch (_) {
          toast({ title: 'Upload Failed', description: 'Could not upload hero image.', variant: 'destructive' });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addHeroSlide = () => {
    setHeroSlides([...heroSlides, { id: crypto.randomUUID(), imageUrl: '', headline: '', description: '', cta: '' }]);
  };

  const removeHeroSlide = (index: number) => {
    setHeroSlides(heroSlides.filter((_, i) => i !== index));
  };


  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUri = reader.result as string;
        setIsUploading(true);
        try {
          const newColors = await extractColorsFromImage(dataUri);
          await updateMerchant({ logo_url: dataUri, brand_colors: newColors });
          toast({ title: 'Logo and Colors Updated!', description: 'Your new brand identity is saved.' });
        } catch (e) {
          logger.error({ error: e as Error, message: 'Logo upload and color extraction failed.' });
          toast({ title: 'Update Failed', description: (e as Error).message, variant: 'destructive' });
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorChange = (role: keyof BrandColors, newColor: string) => {
    if (merchant?.brand_colors) {
      const updatedColors = { ...merchant.brand_colors, [role]: newColor };
      updateMerchant({ brand_colors: updatedColors });
    }
  };

  const handleShuffleColors = () => {
    if (!merchant?.brand_colors) return;
    const { primary, background, accent } = merchant.brand_colors;
    const remappedColors: BrandColors = {
      primary: accent,
      background: primary,
      accent: background,
    };
    updateMerchant({ brand_colors: remappedColors });
  };

  async function onSubmit(data: SettingsFormValues) {
    setIsSaving(true);
    try {
      await updateMerchant({
        ...data,
        hero_slides: heroSlides,
        social_media: socialMedia,
        google_analytics_id: analyticsSettings.google_analytics_id || null,
        ga4_api_secret: analyticsSettings.ga4_api_secret || null,
        facebook_pixel_id: analyticsSettings.facebook_pixel_id || null,
        facebook_capi_token: analyticsSettings.facebook_capi_token || null,
        tiktok_pixel_id: analyticsSettings.tiktok_pixel_id || null,
        tiktok_access_token: analyticsSettings.tiktok_access_token || null,
        snapchat_pixel_id: analyticsSettings.snapchat_pixel_id || null,
        snapchat_capi_token: analyticsSettings.snapchat_capi_token || null,
        twitter_pixel_id: analyticsSettings.twitter_pixel_id || null,
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

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 motion-safe:animate-spin" /></div>;
  }

  const brandColors = merchant?.brand_colors;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-blue-600 bg-clip-text text-transparent">
          Settings ⚙️
        </h1>
      </div>
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
                <div className={cn("relative border-2 border-dashed rounded-lg p-4 h-48 w-full flex flex-col items-center justify-center text-center transition-colors", merchant?.logo_url ? 'border-green-500 bg-green-50/50' : 'border-muted-foreground/50')}>
                  {merchant?.logo_url ? (
                    <>
                      <Image src={merchant.logo_url} alt="Uploaded Logo Preview" fill className="rounded-md p-2 object-contain" />
                      <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1.5 shadow-md"><CheckCircle className="w-4 h-4 text-white" /></div>
                    </>
                  ) : (<><Upload className="w-8 h-8 text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground mb-2">Click to upload new logo</p></>)}
                  {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 motion-safe:animate-spin text-primary" /></div>}
                  <Input id="logo-upload" type="file" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" onChange={handleLogoUpload} aria-label="Upload logo file" disabled={isUploading} />
                </div>
              </div>
              <div className="space-y-4">
                <Label>Brand Colors</Label>
                {brandColors ? (
                  <div className="flex items-center gap-4">
                    <div className="flex gap-4">
                      {(['primary', 'background', 'accent'] as const).map((role) => (
                        <div key={role} className="flex flex-col items-center gap-1.5">
                          <Popover>
                            <PopoverTrigger asChild>
                              <div
                                className="w-12 h-12 rounded-full border-2 cursor-pointer relative group"
                                aria-label={`Edit ${role} color`}
                              >
                                <div
                                  className="w-full h-full rounded-full"
                                  style={{ backgroundColor: brandColors[role as keyof typeof brandColors] }}
                                />
                                <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Pencil className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto">
                              <ColorPicker
                                color={brandColors[role as keyof typeof brandColors]}
                                onChange={(newColor) => handleColorChange(role, newColor)}
                              />
                            </PopoverContent>
                          </Popover>
                          <span className="text-xs font-medium capitalize" style={{ color: brandColors[role as keyof typeof brandColors] }}>{role}</span>
                        </div>
                      ))}
                    </div>
                    <Button type="button" variant="outline" size="icon" onClick={handleShuffleColors} disabled={isUploading} aria-label="Shuffle Colors">
                      <Shuffle className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Upload a logo to generate brand colors.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Favicon</CardTitle>
              <CardDescription>
                Upload a custom favicon for your storefront browser tabs and bookmarks.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaviconUpload />
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Hero Section Carousel</CardTitle>
              <CardDescription>
                Manage the slides for your storefront's hero section. Recommended size: 1920x1080px.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {heroSlides.map((slide, index) => (
                <Card key={slide.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted">
                      {slide.imageUrl ? (
                        <Image src={slide.imageUrl} alt={`Slide ${index + 1}`} width={128} height={80} className="object-cover" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Upload</span>
                      )}
                      <Input id={`hero-image-${index}`} name={`hero-image-${index}`} type="file" accept="image/*" className="absolute w-32 h-20 opacity-0 cursor-pointer" onChange={(e) => handleHeroImageUpload(index, e)} aria-label={`Upload hero slide ${index + 1} image`} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input placeholder="Headline" value={slide.headline} onChange={e => handleHeroSlideChange(index, 'headline', e.target.value)} />
                      <Input placeholder="Description" value={slide.description} onChange={e => handleHeroSlideChange(index, 'description', e.target.value)} />
                      <Input placeholder="Button Text (e.g., Shop Now)" value={slide.cta} onChange={e => handleHeroSlideChange(index, 'cta', e.target.value)} />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeHeroSlide(index)} className="text-destructive">
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
              <CardTitle>Social Media</CardTitle>
              <CardDescription>
                Add your social media handles to improve your store's SEO and social sharing.
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
                    onChange={(e) => setSocialMedia({ ...socialMedia, twitter: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    placeholder="username or page"
                    value={socialMedia.facebook}
                    onChange={(e) => setSocialMedia({ ...socialMedia, facebook: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="flex items-center gap-2">
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="@username"
                    value={socialMedia.instagram}
                    onChange={(e) => setSocialMedia({ ...socialMedia, instagram: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="flex items-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" aria-label="TikTok" role="img">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" fill="currentColor" />
                    </svg>
                    TikTok
                  </Label>
                  <Input
                    id="tiktok"
                    placeholder="@username"
                    value={socialMedia.tiktok}
                    onChange={(e) => setSocialMedia({ ...socialMedia, tiktok: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube" className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-label="YouTube" role="img">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    YouTube
                  </Label>
                  <Input
                    id="youtube"
                    placeholder="channel name or ID"
                    value={socialMedia.youtube}
                    onChange={(e) => setSocialMedia({ ...socialMedia, youtube: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pinterest" className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-label="Pinterest" role="img">
                      <path d="M12 0a12 12 0 0 0-4.37 23.17c-.1-.85-.18-2.24 0-3.21.2-.85 1.17-4.96 1.17-4.96s-.3-.6-.3-1.48c0-1.39.81-2.43 1.82-2.43.86 0 1.27.64 1.27 1.41 0 .86-.55 2.15-.83 3.34-.24.99.5 1.8 1.48 1.8 1.77 0 3.14-1.87 3.14-4.56 0-2.38-1.71-4.05-4.15-4.05-2.83 0-4.49 2.12-4.49 4.31 0 .85.33 1.77.74 2.27.08.1.09.18.07.28l-.27 1.11c-.04.18-.15.21-.34.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.14 2.28-6.03 6.57-6.03 3.45 0 6.13 2.46 6.13 5.75 0 3.43-2.16 6.19-5.16 6.19-1.01 0-1.96-.52-2.28-1.14l-.62 2.37c-.22.87-.83 1.96-1.24 2.62A12 12 0 1 0 12 0z" />
                    </svg>
                    Pinterest
                  </Label>
                  <Input
                    id="pinterest"
                    placeholder="username"
                    value={socialMedia.pinterest}
                    onChange={(e) => setSocialMedia({ ...socialMedia, pinterest: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-label="LinkedIn" role="img">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    placeholder="company name"
                    value={socialMedia.linkedin}
                    onChange={(e) => setSocialMedia({ ...socialMedia, linkedin: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                These handles will be used in meta tags when your products are shared on social media, improving your store's online presence.
              </p>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Analytics & Tracking</CardTitle>
              <CardDescription>
                Connect your analytics accounts to track visitor behavior and conversions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Google Analytics */}
              <div className="space-y-2">
                <Label htmlFor="google_analytics_id" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="currentColor" aria-label="Google Analytics" role="img">
                    <path d="M22.84 2.998a2.157 2.157 0 0 0-2.157-2.16 2.157 2.157 0 1 0 0 4.314 2.157 2.157 0 0 0 2.157-2.154zm-2.157 6.312a2.157 2.157 0 0 0-2.157 2.157v10.376a2.157 2.157 0 0 0 4.314 0V11.467a2.157 2.157 0 0 0-2.157-2.157zM7.157 0A7.157 7.157 0 0 0 0 7.157v9.686a7.157 7.157 0 0 0 14.314 0V7.157A7.157 7.157 0 0 0 7.157 0zm2.843 16.843a2.843 2.843 0 1 1-5.686 0V7.157a2.843 2.843 0 0 1 5.686 0v9.686z" />
                  </svg>
                  Google Analytics 4
                </Label>
                <Input
                  id="google_analytics_id"
                  placeholder="G-XXXXXXXXXX"
                  value={analyticsSettings.google_analytics_id}
                  onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, google_analytics_id: e.target.value })}
                />
                <SetupInstructions platform="google" />

                {analyticsSettings.google_analytics_id && (
                  <div className="mt-3 pl-4 border-l-2 border-orange-200 space-y-2">
                    <Label htmlFor="ga4_api_secret" className="text-sm text-muted-foreground">
                      Measurement Protocol API Secret (Server-Side)
                      <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">Recommended</span>
                    </Label>
                    <Input
                      id="ga4_api_secret"
                      type="password"
                      placeholder="xxxxxxxxxxxxxxxx"
                      value={analyticsSettings.ga4_api_secret}
                      onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, ga4_api_secret: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enables server-side tracking. Get from GA4 Admin → Data Streams → Measurement Protocol API secrets.
                    </p>
                  </div>
                )}
              </div>

              {/* Facebook/Meta */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="facebook_pixel_id" className="flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-600" />
                  Facebook/Meta Pixel
                </Label>
                <Input
                  id="facebook_pixel_id"
                  placeholder="1234567890123456"
                  value={analyticsSettings.facebook_pixel_id}
                  onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, facebook_pixel_id: e.target.value })}
                />
                <SetupInstructions platform="facebook" />

                {analyticsSettings.facebook_pixel_id && (
                  <div className="mt-3 pl-4 border-l-2 border-blue-200 space-y-2">
                    <Label htmlFor="facebook_capi_token" className="text-sm text-muted-foreground">
                      Conversions API Token (Server-Side)
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Recommended</span>
                    </Label>
                    <Input
                      id="facebook_capi_token"
                      type="password"
                      placeholder="EAAxxxxxxxx..."
                      value={analyticsSettings.facebook_capi_token}
                      onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, facebook_capi_token: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Improves tracking accuracy by 10-20%. Bypasses ad blockers.
                    </p>
                  </div>
                )}
              </div>

              {/* TikTok */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="tiktok_pixel_id" className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-label="TikTok Pixel" role="img">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                  </svg>
                  TikTok Pixel
                </Label>
                <Input
                  id="tiktok_pixel_id"
                  placeholder="C1234ABCD5678EFG"
                  value={analyticsSettings.tiktok_pixel_id}
                  onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, tiktok_pixel_id: e.target.value })}
                />
                <SetupInstructions platform="tiktok" />

                {analyticsSettings.tiktok_pixel_id && (
                  <div className="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
                    <Label htmlFor="tiktok_access_token" className="text-sm text-muted-foreground">
                      Events API Access Token (Server-Side)
                    </Label>
                    <Input
                      id="tiktok_access_token"
                      type="password"
                      placeholder="Access token..."
                      value={analyticsSettings.tiktok_access_token}
                      onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, tiktok_access_token: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Snapchat */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="snapchat_pixel_id" className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-yellow-400" viewBox="0 0 24 24" fill="currentColor" aria-label="Snapchat Pixel" role="img">
                    <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" />
                  </svg>
                  Snapchat Pixel
                </Label>
                <Input
                  id="snapchat_pixel_id"
                  placeholder="abc12345-6789-def0-1234-567890abcdef"
                  value={analyticsSettings.snapchat_pixel_id}
                  onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, snapchat_pixel_id: e.target.value })}
                />
                <SetupInstructions platform="snapchat" />

                {analyticsSettings.snapchat_pixel_id && (
                  <div className="mt-3 pl-4 border-l-2 border-yellow-200 space-y-2">
                    <Label htmlFor="snapchat_capi_token" className="text-sm text-muted-foreground">
                      Conversions API Token (Server-Side)
                    </Label>
                    <Input
                      id="snapchat_capi_token"
                      type="password"
                      placeholder="Access token..."
                      value={analyticsSettings.snapchat_capi_token}
                      onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, snapchat_capi_token: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* Twitter/X */}
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="twitter_pixel_id" className="flex items-center gap-2">
                  <Twitter className="w-4 h-4" />
                  Twitter/X Pixel
                </Label>
                <Input
                  id="twitter_pixel_id"
                  placeholder="o1234"
                  value={analyticsSettings.twitter_pixel_id}
                  onChange={(e) => setAnalyticsSettings({ ...analyticsSettings, twitter_pixel_id: e.target.value })}
                />
                <SetupInstructions platform="twitter" />
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>Privacy Note:</strong> All tracking scripts respect cookie consent.
                  They only load when visitors accept analytics/marketing cookies.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Store Details</CardTitle>
              <CardDescription>
                Manage your store's general information and regional settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <FormField
                control={form.control}
                name="business_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your business name" {...field} />
                    </FormControl>
                    <FormDescription>
                      This is the name that will be displayed on your storefront.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="mr-2 text-lg">{country.flag}</span> {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This will determine the default currency and other regional settings.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 motion-safe:animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </Form>

      {/* Team Management Card - Outside the form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            Invite team members to help manage your store with role-based permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/settings/team">
            <Button variant="outline" className="w-full justify-between">
              <span>Manage Team Members</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
