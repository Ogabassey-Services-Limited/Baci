import { getImageProps } from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { Suspense, type ComponentProps, type ReactNode } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import { buildOgabasseyPdpMobileImageSrcSet } from './product-image-source';

interface OgabasseyPdpCriticalShellProps {
  basePath?: string;
  basePathPromise?: Promise<string>;
  children?: ReactNode;
  product: OgabasseyPdpCriticalProduct;
}

type NativeImagePropsWithNextInternals = ComponentProps<'img'> & {
  fill?: unknown;
  loader?: unknown;
  priority?: unknown;
  quality?: unknown;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(price);
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

function getNativeProductImageProps(product: OgabasseyPdpCriticalProduct) {
  const { props } = getImageProps({
    alt: product.name,
    decoding: 'sync',
    fetchPriority: 'high',
    fill: true,
    loader: imageLoader,
    priority: true,
    quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
    src: product.image,
  });
  const {
    fill: _fill,
    loader: _loader,
    priority: _priority,
    quality: _quality,
    ...nativeProps
  } = props as NativeImagePropsWithNextInternals;

  return nativeProps;
}

function getMobileProductImageSourceProps(product: OgabasseyPdpCriticalProduct) {
  return {
    media: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
    sizes: OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
    srcSet: buildOgabasseyPdpMobileImageSrcSet(product.image),
  };
}

export function OgabasseyPdpCriticalShell({
  basePath = '',
  basePathPromise,
  children,
  product,
}: OgabasseyPdpCriticalShellProps) {
  const productImageProps = getNativeProductImageProps(product);
  const mobileSourceProps = getMobileProductImageSourceProps(product);

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
            <picture data-ogabassey-pdp-picture>
              <source {...mobileSourceProps} />
              {/* biome-ignore lint/performance/noImgElement: Server-generated native img avoids passing a loader function through the RSC payload. */}
              <img
                {...productImageProps}
                alt={product.name}
                data-ogabassey-pdp-image="true"
              />
            </picture>
            <span data-ogabassey-pdp-condition>
              {product.condition}
            </span>
          </div>
          <div data-ogabassey-pdp-summary>
            <p data-ogabassey-pdp-brand>{product.brand}</p>
            <h1 data-ogabassey-pdp-title>{product.name}</h1>
            <div data-ogabassey-pdp-rating-row>
              <span data-ogabassey-pdp-stars aria-hidden="true">
                ★★★★★
              </span>
              <span data-ogabassey-pdp-review-count>
                {product.reviewCount} Reviews
              </span>
            </div>
            <div data-ogabassey-pdp-price>{formatPrice(product.price)}</div>
          </div>
          <div data-ogabassey-pdp-commerce-slot>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
