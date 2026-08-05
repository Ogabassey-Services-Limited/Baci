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
import { useEffect, useRef, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSocial } from '@/hooks/merchant/update-social';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';

const SOCIAL_FIELDS = [
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
] as const;

interface SocialMediaCardProps {
  initialSocialMedia: Record<string, string>;
  merchantId: string;
  onMerchantMutationSaved?: (merchantId: string) => Promise<void> | void;
  onSocialMediaChange: (socialMedia: Record<string, string>) => void;
}

export function SocialMediaCard({
  merchantId,
  ...props
}: SocialMediaCardProps) {
  return (
    <SocialMediaCardContents
      key={merchantId}
      merchantId={merchantId}
      {...props}
    />
  );
}

function SocialMediaCardContents({
  initialSocialMedia,
  merchantId,
  onMerchantMutationSaved,
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
  const latestDataRef = useRef<Record<string, string>>(initialSocialMedia);
  const saveGenerationRef = useRef(0);
  useEffect(() => {
    return () => {
      saveGenerationRef.current += 1;
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      if (resetStatusTimeoutRef.current) {
        clearTimeout(resetStatusTimeoutRef.current);
      }
    };
  }, []);

  const autoSave = () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    const saveGeneration = ++saveGenerationRef.current;
    autoSaveTimeoutRef.current = setTimeout(async () => {
      const dataToSave = latestDataRef.current;

      setSaveStatus('saving');
      try {
        // social_media is an IDENTITY field — it must NOT flow through the
        // generic updateMerchant hook (which now throws on it). Persist via the
        // dedicated, server-allowlisted /api/merchant/settings PATCH route.
        await updateSocial(merchantId, dataToSave);
        if (saveGeneration !== saveGenerationRef.current) return;
        await onMerchantMutationSaved?.(merchantId);
        if (saveGeneration !== saveGenerationRef.current) return;
        setSaveStatus('saved');
        if (resetStatusTimeoutRef.current) {
          clearTimeout(resetStatusTimeoutRef.current);
        }
        resetStatusTimeoutRef.current = setTimeout(
          () => setSaveStatus('idle'),
          2000
        );
      } catch (e) {
        if (saveGeneration !== saveGenerationRef.current) return;
        logger.error({
          error: e instanceof Error ? e : new Error(String(e)),
          message: 'Autosave failed',
        });
        setSaveStatus('idle');
        toast({
          title: 'Autosave Failed',
          description: 'Changes could not be saved automatically.',
          variant: 'destructive',
        });
      }
    }, 500);
  };

  const handleChange = (field: string, value: string) => {
    const updated = { ...socialMedia, [field]: value };
    setSocialMedia(updated);
    latestDataRef.current = updated;
    onSocialMediaChange(updated);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Social Media</CardTitle>
          {saveStatus !== 'idle' && (
            <output
              aria-live="polite"
              className={cn(
                'text-xs font-medium flex items-center gap-1 transition-opacity',
                saveStatus === 'saving'
                  ? 'text-muted-foreground'
                  : 'text-green-600'
              )}
            >
              {saveStatus === 'saving' ? (
                <>
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                  Saving…
                </>
              ) : (
                <>
                  <CheckCircle className="size-3" aria-hidden /> Saved
                </>
              )}
            </output>
          )}
        </div>
        <CardDescription>
          Add your social media handles to improve your store's SEO and social
          sharing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          {SOCIAL_FIELDS.map(({ id, label, icon: Icon, placeholder }) => (
            <div key={id} className="space-y-2">
              <Label htmlFor={id} className="flex items-center gap-2">
                <Icon className="size-4" />
                {label}
              </Label>
              <Input
                id={id}
                placeholder={placeholder}
                value={socialMedia[id] || ''}
                onChange={(e) => handleChange(id, e.target.value)}
                onBlur={autoSave}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
