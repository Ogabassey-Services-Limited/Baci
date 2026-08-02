'use client';

import type { ReactNode } from 'react';
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  children: ReactNode;
}

export function OnboardingPreviewExpandedDialog({ children }: Props) {
  return (
    <DialogContent className="w-full h-full max-w-[1600px] overflow-hidden p-0 flex flex-col">
      <DialogHeader className="h-14 border-b flex flex-row items-center justify-between px-6 bg-muted/10">
        <div>
          <DialogTitle>Live Store Preview</DialogTitle>
          <DialogDescription className="sr-only">
            Expanded preview of the generated storefront.
          </DialogDescription>
        </div>
      </DialogHeader>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full">{children}</div>
      </div>
    </DialogContent>
  );
}
