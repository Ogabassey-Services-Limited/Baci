import { getImageProps } from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import type { ComponentProps, ReactNode } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_MEDIA,
  OGABASSEY_PDP_PRIMARY_IMAGE_MOBILE_SIZES,
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import styles from './critical-shell.module.css';
import { buildOgabasseyPdpMobileImageSrcSet } from './product-image-source';

interface OgabasseyPdpCriticalShellProps {
  basePath: string;
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

function getNativeProductImageProps(product: OgabasseyPdpCriticalProduct) {
  const { props } = getImageProps({
    alt: product.name,
    className: styles.image,
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
  basePath,
  children,
  product,
}: OgabasseyPdpCriticalShellProps) {
  const productImageProps = getNativeProductImageProps(product);
  const mobileSourceProps = getMobileProductImageSourceProps(product);

  return (
    <section className={styles.shell} data-ogabassey-pdp-critical-shell>
      <div className={styles.inner} data-ogabassey-pdp-critical-inner>
        <nav
          className={styles.breadcrumbs}
          data-ogabassey-pdp-breadcrumbs
          aria-label="Breadcrumb"
        >
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
        </nav>
        <div className={styles.grid} data-ogabassey-pdp-grid>
          <div className={styles.imageFrame} data-ogabassey-pdp-image-frame>
            <picture data-ogabassey-pdp-picture>
              <source {...mobileSourceProps} />
              {/* biome-ignore lint/performance/noImgElement: Server-generated native img avoids passing a loader function through the RSC payload. */}
              <img {...productImageProps} />
            </picture>
            <span className={styles.condition} data-ogabassey-pdp-condition>
              {product.condition}
            </span>
          </div>
          <div className={styles.summary} data-ogabassey-pdp-summary>
            <p className={styles.brand} data-ogabassey-pdp-brand>
              {product.brand}
            </p>
            <h1 className={styles.title} data-ogabassey-pdp-title>
              {product.name}
            </h1>
            <div className={styles.ratingRow} data-ogabassey-pdp-rating-row>
              <span
                className={styles.stars}
                data-ogabassey-pdp-stars
                aria-hidden="true"
              >
                ★★★★★
              </span>
              <span
                className={styles.reviewCount}
                data-ogabassey-pdp-review-count
              >
                {product.reviewCount} Reviews
              </span>
            </div>
            <div className={styles.price} data-ogabassey-pdp-price>
              {formatPrice(product.price)}
            </div>
          </div>
          <div
            className={styles.commerceSlot}
            data-ogabassey-pdp-commerce-slot
          >
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
