'use client';

import { ArrowRight, FileSpreadsheet, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

export type MigrationSourcePlatform = 'bumpa' | 'shopify';

interface MigrationSourceSelectorProps {
  onValueChange: (value: MigrationSourcePlatform) => void;
  value: MigrationSourcePlatform | null;
}

export const SOURCE_COPY: Record<
  MigrationSourcePlatform,
  {
    availability: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof FileSpreadsheet;
  }
> = {
  bumpa: {
    availability: 'Ready now',
    eyebrow: 'CSV migration',
    title: 'Bumpa',
    description:
      'Upload a Bumpa CSV export, review the preview, and import past orders or products into Baci.',
    icon: FileSpreadsheet,
  },
  shopify: {
    availability: 'Coming next',
    eyebrow: 'Direct connection',
    title: 'Shopify',
    description:
      'Choose Shopify to see the upcoming direct-connection flow for pulling store data into Baci.',
    icon: ShoppingBag,
  },
};

export default function MigrationSourceSelector({
  onValueChange,
  value,
}: MigrationSourceSelectorProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-linear-to-r from-background via-background to-muted/20 p-5 sm:p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
            Source platform
          </p>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Choose your migration source
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Pick where your data is coming from so Baci can show the right
              import steps before you move anything.
            </p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {Object.entries(SOURCE_COPY).map(([sourceKey, source]) => {
            const key = sourceKey as MigrationSourcePlatform;
            const Icon = source.icon;
            const selected = value === key;

            return (
              <button
                aria-pressed={selected}
                className={cn(
                  'group flex min-h-[172px] flex-col items-start justify-between rounded-2xl border bg-background/80 p-5 text-left transition-all hover:border-primary/40 hover:bg-background',
                  selected
                    ? 'border-primary/40 bg-background shadow-sm ring-1 ring-primary/20'
                    : 'border-border/60'
                )}
                key={key}
                onClick={() => onValueChange(key)}
                type="button"
              >
                <div className="flex w-full items-start justify-between gap-4">
                  <div className="space-y-3">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]',
                        selected
                          ? 'border-primary/30 bg-primary/10 text-primary'
                          : 'border-border/70 text-muted-foreground'
                      )}
                    >
                      {source.availability}
                    </span>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-primary" />
                        <span className="text-base font-semibold">
                          {source.title}
                        </span>
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {source.eyebrow}
                      </p>
                    </div>
                  </div>

                  <ArrowRight
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      selected && 'translate-x-0.5 text-primary'
                    )}
                  />
                </div>

                <p className="max-w-[48ch] text-sm leading-6 text-muted-foreground">
                  {source.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
