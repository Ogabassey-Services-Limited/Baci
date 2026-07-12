'use client';

import type {
  RepairDeviceBrandGroup,
  RepairDeviceSummary,
} from '@baci/shared/repairs';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { asRoute, normalizeRouteBasePath } from '@/lib/routes';
import { RepairDeviceCard } from './RepairDeviceCard';

interface RepairDevicePickerProps {
  groups: RepairDeviceBrandGroup[];
  /** Storefront path prefix — '' when served at the domain root, else `/slug`. */
  basePath: string;
  notListedHref: string;
}

const ALL_BRANDS = 'All';

function flattenDevices(
  groups: RepairDeviceBrandGroup[]
): RepairDeviceSummary[] {
  return groups.flatMap((group) => group.devices);
}

function matchesSearch(device: RepairDeviceSummary, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = `${device.brand} ${device.model}`.toLowerCase();
  return haystack.includes(query);
}

/**
 * Client-side device picker: brand chips + search filter a server-fetched
 * device list, each device linking to its `/repairs/[deviceSlug]` page.
 * Reused by both the Ogabassey skin and the generic themed repairs page.
 */
export function RepairDevicePicker({
  basePath,
  groups,
  notListedHref,
}: RepairDevicePickerProps) {
  const [selectedBrand, setSelectedBrand] = useState<string>(ALL_BRANDS);
  const [search, setSearch] = useState('');

  const brands = [ALL_BRANDS, ...groups.map((group) => group.brand)];
  const normalizedBasePath = normalizeRouteBasePath(basePath);
  const normalizedQuery = search.trim().toLowerCase();
  const allDevices = flattenDevices(groups);
  const filteredDevices = allDevices.filter(
    (device) =>
      (selectedBrand === ALL_BRANDS || device.brand === selectedBrand) &&
      matchesSearch(device, normalizedQuery)
  );

  const notListedLink = (
    <Link
      className="font-semibold text-store-primary underline-offset-2 hover:underline"
      href={asRoute(notListedHref)}
    >
      Describe your repair instead
    </Link>
  );

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-store-background-text/40"
        />
        <input
          aria-label="Search devices"
          className="w-full rounded-xl border border-store-border bg-store-background py-2.5 pr-3 pl-9 text-sm text-store-background-text outline-none focus:border-store-primary"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your device (e.g. iPhone 13)"
          type="search"
          value={search}
        />
      </div>

      {brands.length > 1 && (
        <fieldset className="flex flex-wrap gap-2 border-0 p-0 m-0">
          <legend className="sr-only">Filter by brand</legend>
          {brands.map((brand) => (
            <button
              aria-pressed={selectedBrand === brand}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                selectedBrand === brand
                  ? 'border-store-primary bg-store-primary text-store-primary-text'
                  : 'border-store-border bg-store-background text-store-background-text/70 hover:border-store-primary/40'
              }`}
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              type="button"
            >
              {brand}
            </button>
          ))}
        </fieldset>
      )}

      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDevices.map((device) => (
            <RepairDeviceCard
              device={device}
              href={asRoute(`${normalizedBasePath}/repairs/${device.slug}`)}
              key={device.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-store-border bg-store-background p-8 text-center">
          <p className="text-sm font-medium text-store-background-text">
            No devices found.
          </p>
          <p className="mt-1 text-sm text-store-background-text/60">
            {notListedLink}
          </p>
        </div>
      )}

      {filteredDevices.length > 0 && (
        <p className="text-sm text-store-background-text/60">
          Device not listed? {notListedLink}
        </p>
      )}
    </div>
  );
}
