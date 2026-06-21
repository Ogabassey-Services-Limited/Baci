import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, type ReactNode } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import { OgabasseyPdpCriticalConditionBadge } from './critical-commerce.client';
import type { OgabasseyPdpCriticalProduct } from './critical-product';

interface OgabasseyPdpCriticalShellProps {
  basePath?: string;
  basePathPromise?: Promise<string>;
  children?: ReactNode;
  product: OgabasseyPdpCriticalProduct;
  summaryCommerce?: ReactNode;
}

const PRICE_FORMATTER: Intl.NumberFormat = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  maximumFractionDigits: 0,
  style: 'currency',
});

const RATING_FORMATTER: Intl.NumberFormat = new Intl.NumberFormat('en-NG', {
  maximumFractionDigits: 1,
});

function formatPrice(price: number) {
  return PRICE_FORMATTER.format(price);
}

function formatRating(rating: number) {
  const boundedRating = Math.min(Math.max(rating, 0), 5);

  return RATING_FORMATTER.format(boundedRating);
}

function buildPath(basePath: string, path: string): Route {
  const prefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return (`${prefix}${path}` || '/') as Route;
}

function OgabasseyPdpCriticalBreadcrumbItems({
  basePath,
  product,
}: Pick<OgabasseyPdpCriticalShellProps, 'product'> & {
  basePath: string;
}) {
  return (
    <>
      <Link href={buildPath(basePath, '/')} prefetch={false}>
        Home
      </Link>
      <span aria-hidden="true">/</span>
      <Link
        href={buildPath(basePath, `/${product.categorySlug}`)}
        prefetch={false}
      >
        {product.categoryName}
      </Link>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{product.name}</span>
    </>
  );
}

function OgabasseyPdpCriticalBreadcrumbFallback({
  product,
}: Pick<OgabasseyPdpCriticalShellProps, 'product'>) {
  return (
    <>
      <span>Home</span>
      <span aria-hidden="true">/</span>
      <span>{product.categoryName}</span>
      <span aria-hidden="true">/</span>
      <span aria-current="page">{product.name}</span>
    </>
  );
}

async function OgabasseyPdpResolvedCriticalBreadcrumbs({
  basePathPromise,
  product,
}: Pick<OgabasseyPdpCriticalShellProps, 'product'> & {
  basePathPromise: Promise<string>;
}) {
  const basePath = await basePathPromise;

  return (
    <OgabasseyPdpCriticalBreadcrumbItems
      basePath={basePath}
      product={product}
    />
  );
}


export function OgabasseyPdpCriticalShell({
  basePath = '',
  basePathPromise,
  children,
  product,
  summaryCommerce,
}: OgabasseyPdpCriticalShellProps) {
  const aggregateRatingCount = Math.max(
    product.reviewCount,
    product.ratingCount
  );
  const hasRatingSignal = aggregateRatingCount > 0 && product.rating > 0;
  const ratingText = formatRating(product.rating);
  const reviewCountText =
    aggregateRatingCount === 0
      ? 'No reviews yet'
      : product.reviewCount > 0
        ? `${product.reviewCount} ${
            product.reviewCount === 1 ? 'Review' : 'Reviews'
          }`
        : `${aggregateRatingCount} ${
            aggregateRatingCount === 1 ? 'Rating' : 'Ratings'
          }`;
  return (
    <section data-ogabassey-pdp-critical-shell>
      <div data-ogabassey-pdp-critical-inner>
        <nav data-ogabassey-pdp-breadcrumbs aria-label="Breadcrumb">
          {basePathPromise ? (
            <Suspense
              fallback={
                <OgabasseyPdpCriticalBreadcrumbFallback product={product} />
              }
            >
              <OgabasseyPdpResolvedCriticalBreadcrumbs
                basePathPromise={basePathPromise}
                product={product}
              />
            </Suspense>
          ) : (
            <OgabasseyPdpCriticalBreadcrumbItems
              basePath={basePath}
              product={product}
            />
          )}
        </nav>
        <div data-ogabassey-pdp-grid>
          <div data-ogabassey-pdp-image-frame>
            <Image
              alt={product.name}
              data-ogabassey-pdp-image="true"
              fetchPriority="high"
              fill
              loading="eager"
              quality={OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY}
              sizes={OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}
              src={product.image}
            />
            <OgabasseyPdpCriticalConditionBadge
              fallbackCondition={product.condition}
            />
          </div>
          <div data-ogabassey-pdp-summary>
            <p data-ogabassey-pdp-brand>{product.brand}</p>
            <h1 data-ogabassey-pdp-title>{product.name}</h1>
            <div data-ogabassey-pdp-rating-row>
              {hasRatingSignal ? (
                <span
                  data-ogabassey-pdp-stars
                  aria-label={`${ratingText} out of 5 stars`}
                  role="img"
                >
                  {ratingText} ★
                </span>
              ) : null}
              <span data-ogabassey-pdp-review-count>{reviewCountText}</span>
            </div>
            {summaryCommerce || (
              <div data-ogabassey-pdp-price>
                <span data-ogabassey-pdp-price-static>
                  {formatPrice(product.price)}
                </span>
              </div>
            )}
          </div>
          <div data-ogabassey-pdp-commerce-slot>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
