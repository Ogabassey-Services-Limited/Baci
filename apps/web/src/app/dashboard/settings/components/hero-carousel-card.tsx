'use client';

import { Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { HeroSlide } from '@/lib/cached-data';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';

interface HeroCarouselCardProps {
  slides: HeroSlide[];
  onSlidesChange: (slides: HeroSlide[]) => void;
}

export function HeroCarouselCard({
  slides,
  onSlidesChange,
}: HeroCarouselCardProps) {
  const { toast } = useToast();

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

  const updateSlide = (
    index: number,
    field: keyof HeroSlide,
    value: string
  ) => {
    onSlidesChange(
      slides.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleSlideChange = updateSlide;

  const handleImageUpload = (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File Too Large',
        description: 'Hero images must be under 5 MB.',
        variant: 'destructive',
      });
      return;
    }

    const previousUrl = slides[index]?.imageUrl ?? '';
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUri = reader.result as string;
      updateSlide(index, 'imageUrl', dataUri);
      try {
        const uploadedUrl = await uploadImage(dataUri, 'hero-images');
        if (uploadedUrl) {
          updateSlide(index, 'imageUrl', uploadedUrl);
        }
      } catch (error) {
        updateSlide(index, 'imageUrl', previousUrl);
        logger.error({
          error: error instanceof Error ? error : new Error(String(error)),
          message: 'Hero image upload failed',
        });
        toast({
          title: 'Upload Failed',
          description: 'Could not upload hero image.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const addSlide = () => {
    onSlidesChange([
      ...slides,
      {
        id: crypto.randomUUID(),
        imageUrl: '',
        headline: '',
        description: '',
        cta: '',
      },
    ]);
  };

  const removeSlide = (index: number) => {
    onSlidesChange(slides.filter((_, i) => i !== index));
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Hero Section Carousel</CardTitle>
        <CardDescription>
          Manage the slides for your storefront's hero section. Recommended
          size: 1920x1080px.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {slides.map((slide, index) => (
          <Card key={slide.id} className="p-4">
            <div className="flex items-start gap-4">
              <div className="relative w-32 h-20 rounded-md border-2 border-dashed flex items-center justify-center overflow-hidden bg-muted group">
                {slide.imageUrl ? (
                  <Image
                    src={slide.imageUrl}
                    alt={`Slide ${index + 1}`}
                    width={128}
                    height={80}
                    sizes="128px"
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Upload</span>
                )}
                <Input
                  id={`hero-image-${index}`}
                  name={`hero-image-${index}`}
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => handleImageUpload(index, e)}
                  aria-label={`Upload hero slide ${index + 1} image`}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Headline"
                  value={slide.headline}
                  aria-label={`Slide ${index + 1} headline`}
                  onChange={(e) =>
                    handleSlideChange(index, 'headline', e.target.value)
                  }
                />
                <Input
                  placeholder="Description"
                  value={slide.description}
                  aria-label={`Slide ${index + 1} description`}
                  onChange={(e) =>
                    handleSlideChange(index, 'description', e.target.value)
                  }
                />
                <Input
                  placeholder="Button Text (e.g., Shop Now)"
                  value={slide.cta}
                  aria-label={`Slide ${index + 1} button text`}
                  onChange={(e) =>
                    handleSlideChange(index, 'cta', e.target.value)
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlide(index)}
                className="text-destructive"
                aria-label={`Remove slide ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
        <Button type="button" variant="outline" onClick={addSlide}>
          <Plus className="size-4 mr-2" /> Add Slide
        </Button>
      </CardContent>
    </Card>
  );
}
