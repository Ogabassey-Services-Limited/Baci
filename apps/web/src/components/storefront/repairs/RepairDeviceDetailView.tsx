import type { RepairDeviceDetail } from '@baci/shared/repairs';
import { ArrowLeft } from 'lucide-react';
import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { asRoute, joinRouteBasePath } from '@/lib/routes';
import { getProductUrl } from '@/lib/seo-utils';
import { RepairQuoteCard } from './RepairQuoteCard';
import {
  REPAIR_DEVICE_FALLBACK_ICON,
  REPAIR_DEVICE_TYPE_ICONS,
} from './repair-device-icons';

interface RepairDeviceDetailViewProps {
  detail: RepairDeviceDetail;
  basePath: string;
  currency: string;
}

function buildProductHref(
  basePath: string,
  product: RepairDeviceDetail['product']
): Route | null {
  if (!product) {
    return null;
  }

  const productId: string = product.id;
  const productName: string = product.name?.trim() || productId;
  const productSlug: string = product.slug?.trim() || productId;
  const productPath: string = getProductUrl({
    id: productId,
    name: productName,
    slug: productSlug,
  });
  const scopedProductPath: string = joinRouteBasePath(basePath, productPath);

  return asRoute(scopedProductPath);
}

/**
 * Per-device repairs page content: device header (+ linked product specs
 * when available) and the list of active repair quotes, each linking into
 * the booking wizard with `device`/`quote` preselection query params.
 */
export function RepairDeviceDetailView({
  basePath,
  currency,
  detail,
}: RepairDeviceDetailViewProps) {
  const { device, product, quotes } = detail;
  const Icon =
    (device.deviceType && REPAIR_DEVICE_TYPE_ICONS[device.deviceType]) ||
    REPAIR_DEVICE_FALLBACK_ICON;
  const label = `${device.brand} ${device.model}`.trim();
  const repairsIndexHref = asRoute(joinRouteBasePath(basePath, '/repairs'));
  const describeIssueHref = asRoute(
    `${joinRouteBasePath(basePath, '/repair')}?device=${device.slug}`
  );
  const productHref = buildProductHref(basePath, product);

  return (
    <div className="min-h-screen bg-store-secondary pb-24 pt-8 text-store-background-text md:pb-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col px-4 md:px-6">
        <Link
          className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-store-background-text/60 hover:text-store-primary"
          href={repairsIndexHref}
        >
          <ArrowLeft aria-hidden="true" size={16} />
          All devices
        </Link>

        <div className="mb-8 flex flex-col gap-5 rounded-3xl border border-store-border bg-store-background p-6 sm:flex-row sm:items-center">
          <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-store-secondary text-store-background-text/60">
            {device.imageUrl ? (
              <Image
                alt={label}
                className="size-20 object-cover"
                height={80}
                src={device.imageUrl}
                width={80}
              />
            ) : (
              <Icon aria-hidden="true" size={36} />
            )}
          </span>
          <div>
            <h1 className="text-2xl font-bold text-store-background-text">
              {label}
            </h1>
            {device.deviceType && (
              <p className="mt-1 text-sm text-store-background-text/55">
                {device.deviceType}
              </p>
            )}
            {product && productHref && (
              <Link
                className="mt-3 inline-flex items-center text-sm font-semibold text-store-primary underline-offset-2 hover:underline"
                href={productHref}
              >
                View device
              </Link>
            )}
          </div>
        </div>

        {product && product.keySpecs.length > 0 && (
          <div className="mb-8 rounded-2xl border border-store-border bg-store-background p-5">
            <h2 className="mb-3 text-sm font-semibold text-store-background-text/70">
              Specifications
            </h2>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {product.keySpecs.map((spec) => (
                <div key={spec.label}>
                  <dt className="text-xs text-store-background-text/50">
                    {spec.label}
                  </dt>
                  <dd className="text-sm font-medium text-store-background-text">
                    {spec.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <h2 className="mb-4 text-lg font-bold text-store-background-text">
          Repair options
        </h2>

        {quotes.length > 0 ? (
          <div className="space-y-4">
            {quotes.map((quote) => (
              <RepairQuoteCard
                bookHref={buildBookHref(basePath, device.slug, quote.id)}
                currency={currency}
                key={quote.id}
                quote={quote}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-store-border bg-store-background p-8 text-center">
            <p className="text-sm font-medium text-store-background-text">
              No repair options are listed for this device yet.
            </p>
            <Link
              className="mt-2 inline-block text-sm font-semibold text-store-primary underline-offset-2 hover:underline"
              href={describeIssueHref}
            >
              Describe your repair instead
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function buildBookHref(
  basePath: string,
  deviceSlug: string,
  quoteId: string
): Route {
  const repairPath = joinRouteBasePath(basePath, '/repair');
  return asRoute(`${repairPath}?device=${deviceSlug}&quote=${quoteId}`);
}
