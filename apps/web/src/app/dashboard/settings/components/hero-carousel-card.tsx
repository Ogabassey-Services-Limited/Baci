'use client';

import { Layers, Monitor, Plus, Trash2, Upload } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { HeroSlide } from '@/lib/cached-data';
import { logger } from '@/lib/logger';
import { uploadImage } from '@/lib/storage';

interface HeroCarouselCardProps {
  slides: HeroSlide[];
  onSlidesChange: (slides: HeroSlide[]) => void;
  title?: string;
  description?: string;
  recommendedSize?: string;
}

const GRID_BG = {
  backgroundImage: [
    'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px)',
    'linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
  ].join(', '),
  backgroundSize: '24px 24px',
} as const;

export function HeroCarouselCard({
  slides,
  onSlidesChange,
  title = 'Hero Section Carousel',
  description = "Manage the slides for your storefront's hero section.",
  recommendedSize = '1920x1080px',
}: HeroCarouselCardProps) {
  const { toast } = useToast();
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-card shadow-sm">
      {/* === Command Header === */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 px-6 py-5">
        <div className="absolute inset-0" style={GRID_BG} />
        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white flex items-center gap-2.5">
              <Monitor className="w-[18px] h-[18px] text-cyan-400 shrink-0" />
              {title}
            </h3>
            <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">
              {description} Recommended size: {recommendedSize}.
            </p>
          </div>
          <Badge className="shrink-0 bg-cyan-500/10 text-cyan-400 border-cyan-500/20 font-mono text-[11px] tracking-wide hover:bg-cyan-500/10">
            {slides.length} {slides.length === 1 ? 'SLIDE' : 'SLIDES'}
          </Badge>
        </div>
      </div>

      {/* === Panel Content === */}
      <div className="p-6 space-y-4">
        {slides.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-4">
              <Layers className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No slides configured
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-60">
              Add hero banners to make your storefront stand out
            </p>
          </div>
        ) : (
          slides.map((slide, index) => (
            <div
              key={slide.id}
              className="group relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-4 transition-all duration-200 hover:border-cyan-500/30 hover:shadow-[0_0_20px_rgba(6,182,212,0.04)]"
            >
              {/* Panel label + delete */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-cyan-600 dark:text-cyan-400 font-semibold select-none">
                  Display {String(index + 1).padStart(2, '0')}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSlide(index)}
                  className="h-7 w-7 text-slate-400 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove slide ${index + 1}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="flex items-start gap-4">
                {/* Screen viewport */}
                <div className="relative w-36 h-[90px] rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-black/40 flex items-center justify-center overflow-hidden shrink-0">
                  {slide.imageUrl ? (
                    <Image
                      src={slide.imageUrl}
                      alt={`Slide ${index + 1}`}
                      width={144}
                      height={90}
                      sizes="144px"
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1.5">
                      <Upload className="w-4 h-4 text-slate-400" />
                      <span className="text-[10px] font-mono text-slate-400 tracking-wide">
                        UPLOAD
                      </span>
                    </div>
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

                {/* Fields */}
                <div className="flex-1 space-y-2 min-w-0">
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
              </div>
            </div>
          ))
        )}

        <Button
          type="button"
          variant="outline"
          onClick={addSlide}
          className="w-full border-dashed border-slate-300 dark:border-slate-700 hover:border-cyan-500/40 hover:bg-cyan-500/[0.03] hover:text-cyan-600 dark:hover:text-cyan-400 transition-all"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Slide
        </Button>
      </div>
    </div>
  );
}
