import type { RepairDeviceBrandGroup } from '@baci/shared/repairs';
import { Wrench } from 'lucide-react';
import { joinRouteBasePath } from '@/lib/routes';
import { RepairDevicePicker } from './RepairDevicePicker';

interface GenericRepairsPageProps {
  merchantName: string;
  basePath: string;
  groups: RepairDeviceBrandGroup[];
}

/**
 * Themed, catalogue-driven repairs landing page for merchants on templates
 * other than Ogabassey. Server component — the only client-side piece is
 * the search/filter interaction inside RepairDevicePicker.
 */
export function GenericRepairsPage({
  basePath,
  groups,
  merchantName,
}: GenericRepairsPageProps) {
  const notListedHref = joinRouteBasePath(basePath, '/repair');

  return (
    <div className="min-h-screen bg-store-secondary pb-24 pt-8 text-store-background-text md:pb-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 md:px-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="rounded-lg bg-store-primary/10 p-2 text-store-primary">
            <Wrench size={24} />
          </div>
          <h1 className="text-2xl font-bold text-store-background-text">
            Device Repairs
          </h1>
        </div>
        <p className="mb-8 max-w-xl text-sm text-store-background-text/60">
          Select your device to see repair options and pricing from{' '}
          {merchantName}.
        </p>

        <RepairDevicePicker
          basePath={basePath}
          groups={groups}
          notListedHref={notListedHref}
        />
      </div>
    </div>
  );
}
