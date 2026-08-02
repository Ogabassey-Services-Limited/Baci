'use client';

import type { Data } from '@puckeditor/core';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DialogTrigger } from '@/components/ui/dialog';
import type { BrandColors } from '@/types';

interface Props {
  brandColors: BrandColors;
  data: Data;
  onEdit?: (data: Data) => void;
  onExpand?: () => void;
}

export function OnboardingPreviewControls({
  brandColors,
  data,
  onEdit,
  onExpand,
}: Props) {
  const expandButton = (
    <Button
      size="sm"
      variant="secondary"
      className="shadow-sm border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background h-8 text-xs gap-2"
      onClick={onExpand}
    >
      <span aria-hidden="true">↗</span> Expand
    </Button>
  );
  return (
    <>
      <div className="absolute top-14 right-4 z-50 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {onExpand ? (
          expandButton
        ) : (
          <DialogTrigger asChild>{expandButton}</DialogTrigger>
        )}
      </div>
      {onEdit && (
        <div className="absolute top-14 left-4 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <Button
            size="sm"
            variant="secondary"
            className="shadow-sm border border-white/10 bg-background/80 backdrop-blur-md hover:bg-background h-8 text-xs pr-3 pl-2"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(data);
            }}
          >
            <Pencil
              className="size-3 mr-2"
              style={{ color: brandColors.primary }}
            />{' '}
            Edit Template
          </Button>
        </div>
      )}
    </>
  );
}
