
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
import { Loader2, Upload, CheckCircle, Pencil, Shuffle } from 'lucide-react';
import Image from 'next/image';
import { logger } from '@/lib/logger';
import ColorThief from 'colorthief';
import { extend } from 'colord';
import a11yPlugin from 'colord/plugins/a11y';
import { ColorPicker } from '@/components/color-picker';
import type { BrandColors } from '@/types';
import { cn } from '@/lib/utils';

extend([a11yPlugin]);

const settingsSchema = z.object({
  business_name: z.string().min(2, 'Business name must be at least 2 characters.'),
  country: z.string().min(2, 'Please select a country.'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

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
    }
  }, [merchant, form]);

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
      await updateMerchant(data);
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
    return <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const brandColors = merchant?.brand_colors;

  return (
    <div className="grid gap-6">
      <Card>
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
              {isUploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}
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
                            <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center opacity-100">
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
                <Button variant="outline" size="icon" onClick={handleShuffleColors} disabled={isUploading} aria-label="Shuffle Colors">
                  <Shuffle className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Upload a logo to generate brand colors.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
          <CardDescription>
            Manage your store's general information and regional settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
