'use client';

import { ArrowRight, FileSpreadsheet, ShoppingBag } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export type MigrationSourcePlatform = 'bumpa' | 'shopify';

interface MigrationSourceSelectorProps {
  onValueChange: (value: MigrationSourcePlatform) => void;
  value: MigrationSourcePlatform;
}

const SOURCE_COPY: Record<
  MigrationSourcePlatform,
  {
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof FileSpreadsheet;
  }
> = {
  bumpa: {
    eyebrow: 'CSV migration',
    title: 'Bumpa',
    description:
      'Upload exported CSV files, review a normalized preview, and import historical orders or products.',
    icon: FileSpreadsheet,
  },
  shopify: {
    eyebrow: 'Connected migration',
    title: 'Shopify',
    description:
      'Prepare for a direct Shopify connection flow without leaving the migrations workspace.',
    icon: ShoppingBag,
  },
};

export { SOURCE_COPY };

export default function MigrationSourceSelector({
  onValueChange,
  value,
}: MigrationSourceSelectorProps) {
  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-background via-background to-muted/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
            Source platform
          </p>
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Choose how you want to migrate into Baci
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Keep each source on its own workflow instead of forcing every
              importer through a Bumpa-shaped screen.
            </p>
          </div>
        </div>

        <Tabs
          className="w-full lg:w-auto"
          onValueChange={(nextValue) =>
            onValueChange(nextValue as MigrationSourcePlatform)
          }
          value={value}
        >
          <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-muted/50 p-2 lg:min-w-[360px]">
            {(
              Object.entries(SOURCE_COPY) as [
                MigrationSourcePlatform,
                (typeof SOURCE_COPY)[MigrationSourcePlatform],
              ][]
            ).map(([sourceKey, source]) => {
              const Icon = source.icon;

              return (
                <TabsTrigger
                  className={cn(
                    'flex h-auto flex-col items-start gap-3 rounded-xl border border-transparent px-4 py-3 text-left data-[state=active]:border-primary/30 data-[state=active]:bg-background',
                    value === sourceKey && 'shadow-sm'
                  )}
                  key={sourceKey}
                  value={sourceKey}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        {source.title}
                      </span>
                    </div>
                    <ArrowRight className="h-4 w-4 opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      {source.eyebrow}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {source.description}
                    </p>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
}
