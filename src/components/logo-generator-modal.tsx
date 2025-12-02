'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LogoGeneratorModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (favoriteColor: string) => void;
  isGenerating: boolean;
}

export function LogoGeneratorModal({
  isOpen,
  onOpenChange,
  onGenerate,
  isGenerating,
}: LogoGeneratorModalProps) {
  const [favoriteColor, setFavoriteColor] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (favoriteColor.trim()) {
      onGenerate(favoriteColor);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate AI Logo</DialogTitle>
          <DialogDescription>
            Tell us your favorite color, and our AI will create a unique,
            minimalist logo for your brand.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="favorite-color">
              What is your favorite color or color scheme?
            </Label>
            <Input
              id="favorite-color"
              placeholder="e.g. Royal Blue, Sunset Orange, Pastel Pink"
              value={favoriteColor}
              onChange={(e) => setFavoriteColor(e.target.value)}
              autoFocus
              disabled={isGenerating}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!favoriteColor.trim() || isGenerating}
              className="w-full sm:w-auto"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Magic...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-4 w-4" />
                  Generate Logo
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
