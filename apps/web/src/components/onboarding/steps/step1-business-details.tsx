'use client';

import { Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TypingPlaceholderInput } from '@/components/ui/typing-placeholder-input';
import { getAllBusinessTypes } from '@/config/business-types';
import { cn } from '@/lib/utils';
import type { OnboardingFormValues } from '@/schemas/onboarding';

// Dynamically import heavy modal
const BusinessNameGeneratorModal = dynamic(
  () =>
    import('@/components/business-name-generator-modal').then(
      (mod) => mod.BusinessNameGeneratorModal
    ),
  { ssr: false }
);

const premiumInputClass =
  'bg-white/50 dark:bg-black/20 border-primary/10 focus:border-primary/50 transition-all shadow-sm';

interface Step1Props {
  onKeyDown: (
    e: React.KeyboardEvent<HTMLInputElement | HTMLButtonElement>
  ) => void;
}

export default function Step1_BusinessDetails({ onKeyDown }: Step1Props) {
  const { control, setValue } = useFormContext<OnboardingFormValues>();
  const businessTypeValue = useWatch({
    control,
    name: 'businessType',
  });
  const businessTypes = getAllBusinessTypes();

  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="businessType"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">
              What's the nature of your business?
            </FormLabel>
            <Select
              onValueChange={(value) => {
                setValue('businessType', value, {
                  shouldDirty: true,
                  shouldTouch: true,
                  shouldValidate: true,
                });
              }}
              value={field.value}
              name="businessType"
            >
              <FormControl>
                <SelectTrigger
                  onKeyDown={onKeyDown}
                  className={cn(
                    premiumInputClass,
                    '[&>span]:line-clamp-none [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-2',
                    !field.value && 'text-muted-foreground'
                  )}
                >
                  <SelectValue placeholder="e.g., Fashion, Electronics, Art..." />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {businessTypes.map((type) => {
                  // Emoji mapping for business types
                  const emojiMap: Record<string, string> = {
                    fashion: '👗',
                    electronics: '💻',
                    'home-goods': '🏠',
                    'health-beauty': '💄',
                    handmade: '🎨',
                    'food-beverage': '🍔',
                    'hair-extensions': '💇‍♀️',
                  };
                  const emoji = emojiMap[type.id] || '🏢';

                  return (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2 w-full min-w-0">
                        <span className="text-lg flex-shrink-0">{emoji}</span>
                        <span className="text-primary truncate">
                          {type.label}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {businessTypeValue === 'other' && (
        <FormField
          control={control}
          name="otherBusinessType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Please specify</FormLabel>
              <FormControl>
                <TypingPlaceholderInput
                  staticPrefix="e.g., "
                  placeholders={[
                    'Pet Services',
                    'Consulting',
                    'Event Planning',
                    'Tutoring',
                  ]}
                  {...field}
                  onChange={(e) => {
                    setValue('otherBusinessType', e.target.value, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                  }}
                  onKeyDown={onKeyDown}
                  name="otherBusinessType"
                  autoComplete="organization"
                  className={premiumInputClass}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
      <FormField
        control={control}
        name="businessName"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-lg">
              What is your business name?
            </FormLabel>
            <FormControl>
              <TypingPlaceholderInput
                staticPrefix="e.g., "
                placeholders={[
                  "Amara's Fashion",
                  'Tech Haven',
                  'The Coffee Spot',
                  'Green Grocer',
                  'Urban Styles',
                ]}
                {...field}
                onChange={(e) => {
                  // Convert to sentence case (title case)
                  const words = e.target.value.split(' ');
                  const titleCased = words
                    .map((word) => {
                      if (word.length === 0) return word;
                      return (
                        word.charAt(0).toUpperCase() +
                        word.slice(1).toLowerCase()
                      );
                    })
                    .join(' ');
                  setValue('businessName', titleCased, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
                onKeyDown={onKeyDown}
                name="businessName"
                autoComplete="organization"
                className={premiumInputClass}
              />
            </FormControl>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="group h-auto p-0 text-[13px] font-semibold text-primary hover:bg-transparent transition-all duration-300"
              onClick={() => setIsGeneratorOpen(true)}
            >
              <Sparkles className="w-3.5 h-3.5 mr-0.5 text-amber-500 group-hover:text-amber-600 transition-colors" />
              <span className="bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary/90 group-hover:to-primary/60">
                Generate Business Name
              </span>
            </Button>
            <FormMessage />
          </FormItem>
        )}
      />
      <BusinessNameGeneratorModal
        isOpen={isGeneratorOpen}
        onOpenChange={setIsGeneratorOpen}
        onNameSelect={(name) => {
          setValue('businessName', name, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
        businessType={businessTypeValue}
      />
    </div>
  );
}
