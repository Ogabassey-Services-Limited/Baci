'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import ColorThief from 'colorthief';
import {
  CheckCircle,
  ChevronRight,
  Facebook,
  Instagram,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Shuffle,
  Trash2,
  Twitter,
  Upload,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AddressAutocomplete } from '@/components/address-autocomplete';
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
import { PhoneInput } from '@/components/ui/phone-input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useMerchant } from '@/hooks/use-merchant';
import { useToast } from '@/hooks/use-toast';
import { COUNTRIES } from '@/lib/countries';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type { BrandColors } from '@/types';
import { FaviconUpload } from './favicon-upload';

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
  const [contactInfo, setContactInfo] = useState({
    support_email: '',
    support_phone: '',
    business_address: '',
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );
  /* Analytics moved to Integrations pages */

  // Autosave function for blur-based saving
  const autoSave = async (data: {
    social_media?: Record<string, string>;
    support_email?: string | null;
    support_phone?: string | null;
    business_address?: string | null;
  }) => {
    setSaveStatus('saving');
    try {
      await updateMerchant(data as Parameters<typeof updateMerchant>[0], {
        skipReload: true,
      });
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
  };

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
      const socialMedia = merchantData.social_media as
        | Record<string, unknown>
        | undefined;
      setSocialMedia({
        twitter: (socialMedia?.twitter as string) || '',
        facebook: (socialMedia?.facebook as string) || '',
        instagram: (socialMedia?.instagram as string) || '',
        tiktok: (socialMedia?.tiktok as string) || '',
        youtube: (socialMedia?.youtube as string) || '',
        pinterest: (socialMedia?.pinterest as string) || '',
        linkedin: (socialMedia?.linkedin as string) || '',
      });
      setContactInfo({
        support_email: (merchantData.support_email as string) || '',
        support_phone: (merchantData.support_phone as string) || '',
        business_address: (merchantData.business_address as string) || '',
      });
      /* Analytics hydration moved */
    }
  }, [merchant, form]);

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
          const newColors = await extractColorsFromImage(dataUri);
          await updateMerchant({ logo_url: dataUri, brand_colors: newColors });
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
        support_email: contactInfo.support_email || null,
        support_phone: contactInfo.support_phone || null,
        business_address: contactInfo.business_address || null,
        /* Analytics fields updated via Integrations pages */
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
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 motion-safe:animate-spin" />
      </div>
    );
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
                <div
                  className={cn(
                    'relative border-2 border-dashed rounded-lg p-4 h-48 w-full flex flex-col items-center justify-center text-center transition-colors',
                    merchant?.logo_url
                      ? 'border-green-500 bg-green-50/50'
                      : 'border-muted-foreground/50'
                  )}
                >
                  {merchant?.logo_url ? (
                    <>
                      <Image
                        src={merchant.logo_url}
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
                                    brandColors[
                                      role as keyof typeof brandColors
                                    ]
                                  }
                                  onChange={(newColor) =>
                                    handleColorChange(role, newColor)
                                  }
                                />
                              </PopoverContent>
                            </Popover>
                            <span
                              className="text-xs font-medium capitalize"
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
                Manage the slides for your storefront's hero section.
                Recommended size: 1920x1080px.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {heroSlides.map((slide, index) => (
                <Card key={slide.id} className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-32 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted">
                      {slide.imageUrl ? (
                        <Image
                          src={slide.imageUrl}
                          alt={`Slide ${index + 1}`}
                          width={128}
                          height={80}
                          className="object-cover"
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
                        className="absolute w-32 h-20 opacity-0 cursor-pointer"
                        onChange={(e) => handleHeroImageUpload(index, e)}
                        aria-label={`Upload hero slide ${index + 1} image`}
                      />
                    </div>
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Headline"
                        value={slide.headline}
                        onChange={(e) =>
                          handleHeroSlideChange(
                            index,
                            'headline',
                            e.target.value
                          )
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
                      variant="ghost"
                      size="icon"
                      onClick={() => removeHeroSlide(index)}
                      className="text-destructive"
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
                Add your social media handles to improve your store's SEO and
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
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="flex items-center gap-2">
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </Label>
                  <Input
                    id="facebook"
                    placeholder="@username or page"
                    value={socialMedia.facebook}
                    onChange={(e) =>
                      setSocialMedia({
                        ...socialMedia,
                        facebook: e.target.value,
                      })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="instagram"
                    className="flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </Label>
                  <Input
                    id="instagram"
                    placeholder="@username"
                    value={socialMedia.instagram}
                    onChange={(e) =>
                      setSocialMedia({
                        ...socialMedia,
                        instagram: e.target.value,
                      })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok" className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-label="TikTok"
                      role="img"
                    >
                      <path
                        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
                        fill="currentColor"
                      />
                    </svg>
                    TikTok
                  </Label>
                  <Input
                    id="tiktok"
                    placeholder="@username"
                    value={socialMedia.tiktok}
                    onChange={(e) =>
                      setSocialMedia({ ...socialMedia, tiktok: e.target.value })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube" className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="YouTube"
                      role="img"
                    >
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                    </svg>
                    YouTube
                  </Label>
                  <Input
                    id="youtube"
                    placeholder="channel name or ID"
                    value={socialMedia.youtube}
                    onChange={(e) =>
                      setSocialMedia({
                        ...socialMedia,
                        youtube: e.target.value,
                      })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="pinterest"
                    className="flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="Pinterest"
                      role="img"
                    >
                      <path d="M12 0a12 12 0 0 0-4.37 23.17c-.1-.85-.18-2.24 0-3.21.2-.85 1.17-4.96 1.17-4.96s-.3-.6-.3-1.48c0-1.39.81-2.43 1.82-2.43.86 0 1.27.64 1.27 1.41 0 .86-.55 2.15-.83 3.34-.24.99.5 1.8 1.48 1.8 1.77 0 3.14-1.87 3.14-4.56 0-2.38-1.71-4.05-4.15-4.05-2.83 0-4.49 2.12-4.49 4.31 0 .85.33 1.77.74 2.27.08.1.09.18.07.28l-.27 1.11c-.04.18-.15.21-.34.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.14 2.28-6.03 6.57-6.03 3.45 0 6.13 2.46 6.13 5.75 0 3.43-2.16 6.19-5.16 6.19-1.01 0-1.96-.52-2.28-1.14l-.62 2.37c-.22.87-.83 1.96-1.24 2.62A12 12 0 1 0 12 0z" />
                    </svg>
                    Pinterest
                  </Label>
                  <Input
                    id="pinterest"
                    placeholder="@username"
                    value={socialMedia.pinterest}
                    onChange={(e) =>
                      setSocialMedia({
                        ...socialMedia,
                        pinterest: e.target.value,
                      })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-label="LinkedIn"
                      role="img"
                    >
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </Label>
                  <Input
                    id="linkedin"
                    placeholder="company name"
                    value={socialMedia.linkedin}
                    onChange={(e) =>
                      setSocialMedia({
                        ...socialMedia,
                        linkedin: e.target.value,
                      })
                    }
                    onBlur={() => autoSave({ social_media: socialMedia })}
                  />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                These handles will be used in meta tags when your products are
                shared on social media, improving your store's online presence.
              </p>
            </CardContent>
          </Card>

          {/* Ad Unit: After Social Media */}
          <DashboardAdUnit variant="horizontal" />

          <Card className="glass">
            <CardHeader>
              <CardTitle>Delivery Settings</CardTitle>
              <CardDescription>
                Configure how you deliver products to your customers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <div className="space-y-0.5">
                  <Label htmlFor="pay_on_delivery">Pay on Delivery</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow customers to pay when they receive their order.
                  </p>
                </div>
                <Switch
                  id="pay_on_delivery"
                  checked={
                    merchant?.feature_settings?.pay_on_delivery_enabled || false
                  }
                  onCheckedChange={(checked) => {
                    if (merchant?.feature_settings) {
                      updateMerchant({
                        feature_settings: {
                          ...merchant.feature_settings,
                          pay_on_delivery_enabled: checked,
                        },
                      });
                    }
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rider_phone">Rider WhatsApp Number</Label>
                <p className="text-sm text-muted-foreground">
                  Enter a phone number to receive WhatsApp notifications for Pay
                  on Delivery orders.
                </p>
                <PhoneInput
                  id="rider_phone"
                  placeholder="Enter phone number"
                  defaultCountry="NG"
                  value={merchant?.rider_phone_number || ''}
                  onChange={(value) =>
                    updateMerchant({ rider_phone_number: value || '' })
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Contact Information</CardTitle>
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
                These details will be displayed in your store footer, making it
                easy for customers to contact you for support.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="support_email"
                  className="flex items-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Support Email
                </Label>
                <Input
                  id="support_email"
                  type="email"
                  placeholder="support@yourstore.com"
                  value={contactInfo.support_email}
                  onChange={(e) =>
                    setContactInfo({
                      ...contactInfo,
                      support_email: e.target.value,
                    })
                  }
                  onBlur={() =>
                    autoSave({
                      support_email: contactInfo.support_email || null,
                      support_phone: contactInfo.support_phone || null,
                      business_address: contactInfo.business_address || null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="support_phone"
                  className="flex items-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Support Phone
                </Label>
                <PhoneInput
                  id="support_phone"
                  placeholder="Enter phone number"
                  defaultCountry="NG"
                  value={contactInfo.support_phone}
                  onChange={(value) =>
                    setContactInfo({
                      ...contactInfo,
                      support_phone: value || '',
                    })
                  }
                  onBlur={() =>
                    autoSave({
                      support_email: contactInfo.support_email || null,
                      support_phone: contactInfo.support_phone || null,
                      business_address: contactInfo.business_address || null,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="business_address"
                  className="flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Business Address
                </Label>
                <AddressAutocomplete
                  id="business_address"
                  placeholder="Start typing your address..."
                  country="NG"
                  value={contactInfo.business_address}
                  onChange={(e) => {
                    const newValue = typeof e === 'string' ? e : e.target.value;
                    setContactInfo({
                      ...contactInfo,
                      business_address: newValue,
                    });
                  }}
                  onSelect={(place) => {
                    setContactInfo({
                      ...contactInfo,
                      business_address: place.formattedAddress,
                    });
                    // Auto-save after selecting from Google
                    autoSave({
                      support_email: contactInfo.support_email || null,
                      support_phone: contactInfo.support_phone || null,
                      business_address: place.formattedAddress || null,
                    });
                  }}
                  onBlur={() =>
                    autoSave({
                      support_email: contactInfo.support_email || null,
                      support_phone: contactInfo.support_phone || null,
                      business_address: contactInfo.business_address || null,
                    })
                  }
                />
              </div>
              <p className="text-sm text-muted-foreground">
                This information will be displayed in your store footer and
                helps customers contact you for support.
              </p>
            </CardContent>
          </Card>

          {/* Ad Unit: After Contact Info */}
          <DashboardAdUnit variant="horizontal" />

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
                      This is the name that will be displayed on your
                      storefront.
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
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            <span className="mr-2 text-lg">{country.flag}</span>{' '}
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      This will determine the default currency and other
                      regional settings.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

      {/* Payment Settings Card - Outside the form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-label="Payment"
              role="img"
            >
              <rect width="20" height="14" x="2" y="5" rx="2" />
              <line x1="2" x2="22" y1="10" y2="10" />
            </svg>
            Payment Settings
          </CardTitle>
          <CardDescription>
            Configure payment gateways, bank settlement, and transaction
            preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/settings/payments">
            <Button variant="outline" className="w-full justify-between">
              <span>Manage Payment Settings</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Team Management Card - Outside the form */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Management
          </CardTitle>
          <CardDescription>
            Invite team members to help manage your store with role-based
            permissions.
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
