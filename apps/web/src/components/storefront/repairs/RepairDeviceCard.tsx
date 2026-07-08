import type { RepairDeviceSummary } from '@baci/shared/repairs';
import { ChevronRight } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  REPAIR_DEVICE_FALLBACK_ICON,
  REPAIR_DEVICE_TYPE_ICONS,
} from './repair-device-icons';

interface RepairDeviceCardProps {
  device: RepairDeviceSummary;
  href: Route;
}

/**
 * A single device tile in the repairs device picker. Themed with
 * `var(--store-*)` tokens so it renders correctly across templates.
 */
export function RepairDeviceCard({ device, href }: RepairDeviceCardProps) {
  const Icon =
    (device.deviceType && REPAIR_DEVICE_TYPE_ICONS[device.deviceType]) ||
    REPAIR_DEVICE_FALLBACK_ICON;
  const label = `${device.brand} ${device.model}`.trim();

  return (
    <Link
      className="group flex items-center gap-3 rounded-2xl border border-store-border bg-store-background p-3 transition-all hover:border-store-primary/40 hover:shadow-md"
      href={href}
    >
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-store-secondary text-store-background-text/60 group-hover:text-store-primary">
        {device.imageUrl ? (
          <Image
            alt={label}
            className="size-14 object-cover"
            height={56}
            src={device.imageUrl}
            width={56}
          />
        ) : (
          <Icon aria-hidden="true" size={24} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-store-background-text">
          {label}
        </span>
        {device.deviceType && (
          <span className="block text-xs text-store-background-text/55">
            {device.deviceType}
          </span>
        )}
      </span>
      <ChevronRight
        aria-hidden="true"
        className="shrink-0 text-store-background-text/30 group-hover:text-store-primary"
        size={16}
      />
    </Link>
  );
}
