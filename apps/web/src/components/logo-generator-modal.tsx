'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface LogoGeneratorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (favoriteColor: string) => void;
  isGenerating: boolean;
  children: React.ReactNode; // The trigger button
}

export function LogoGeneratorModal({
  isOpen,
  onOpenChange,
  onGenerate,
  isGenerating,
  children,
}: LogoGeneratorModalProps) {
  const [favoriteColor, setFavoriteColor] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (favoriteColor.trim()) {
      onGenerate(favoriteColor);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80"
        align="center"
        side="top"
        sideOffset={10}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Generate AI Logo</h4>
            <p className="text-xs text-muted-foreground">
              Tell us your favorite color to create a unique logo.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="favorite-color" className="text-xs">
                Favorite color or color scheme
              </Label>
              <Input
                id="favorite-color"
                placeholder="e.g. Royal Blue, Sunset Orange"
                value={favoriteColor}
                onChange={(e) => setFavoriteColor(e.target.value)}
                autoFocus
                disabled={isGenerating}
                className="h-9 text-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={!favoriteColor.trim() || isGenerating}
              className="w-full h-9"
              size="sm"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 size-3.5" />
                  Generate Logo
                </>
              )}
            </Button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
