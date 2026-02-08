'use client';

import {
  CheckCircle,
  Facebook,
  Ghost,
  Instagram,
  Linkedin,
  Loader2,
  Music,
  Twitter,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

interface SocialMediaCardProps {
  initialSocialMedia: Record<string, string>;
  updateMerchant: (
    // biome-ignore lint/suspicious/noExplicitAny: updateMerchant accepts dynamic merchant data
    data: any,
    options?: { skipReload?: boolean }
  ) => Promise<void>;
  onSocialMediaChange: (socialMedia: Record<string, string>) => void;
}

export function SocialMediaCard({
  initialSocialMedia,
  updateMerchant,
  onSocialMediaChange,
}: SocialMediaCardProps) {
  const { toast } = useToast();
  const [socialMedia, setSocialMedia] =
    useState<Record<string, string>>(initialSocialMedia);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle'
  );

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const resetStatusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (resetStatusTimeoutRef.current) {
        clearTimeout(resetStatusTimeoutRef.current);
      }
    };
  }, []);

  const autoSave = useCallback(
    (data: { social_media?: Record<string, string> }) => {
      latestDataRef.current = data;

      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      autoSaveTimeoutRef.current = setTimeout(async () => {
        const dataToSave = latestDataRef.current;
        if (!dataToSave) return;

        setSaveStatus('saving');
        try {
          await updateMerchant(dataToSave, { skipReload: true });
          setSaveStatus('saved');
          if (resetStatusTimeoutRef.current) {
            clearTimeout(resetStatusTimeoutRef.current);
          }
          resetStatusTimeoutRef.current = setTimeout(
            () => setSaveStatus('idle'),
            2000
          );
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

  const handleChange = (field: string, value: string) => {
    const updated = { ...socialMedia, [field]: value };
    setSocialMedia(updated);
    onSocialMediaChange(updated);
  };

  const fields = [
    {
      id: 'twitter',
      label: 'Twitter',
      icon: Twitter,
      placeholder: '@username',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      icon: Instagram,
      placeholder: '@username',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      icon: Facebook,
      placeholder: 'Facebook URL',
    },
    { id: 'tiktok', label: 'TikTok', icon: Music, placeholder: '@username' },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      icon: Linkedin,
      placeholder: 'LinkedIn Company URL',
    },
    {
      id: 'snapchat',
      label: 'Snapchat',
      icon: Ghost,
      placeholder: '@username',
    },
  ];

  return (
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
          Add your social media handles to improve your store's SEO and social
          sharing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {fields.map(({ id, label, icon: Icon, placeholder }) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id} className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {label}
              </Label>
              <Input
                id={id}
                placeholder={placeholder}
                value={socialMedia[id] || ''}
                onChange={(e) => handleChange(id, e.target.value)}
                onBlur={() => autoSave({ social_media: socialMedia })}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
