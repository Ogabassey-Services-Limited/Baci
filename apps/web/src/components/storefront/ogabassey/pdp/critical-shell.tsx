import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';
import imageLoader from '@/lib/image-loader';
import type { OgabasseyPdpCriticalProduct } from './critical-product';
import styles from './critical-shell.module.css';

interface OgabasseyPdpCriticalShellProps {
  basePath: string;
  children?: ReactNode;
  product: OgabasseyPdpCriticalProduct;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('en-NG', {
    currency: 'NGN',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(price);
}

function buildPath(basePath: string, path: string) {
  const prefix = basePath === '/' ? '' : basePath.replace(/\/$/, '');
  return `${prefix}${path}` || '/';
}

export function OgabasseyPdpCriticalShell({
  basePath,
  children,
  product,
}: OgabasseyPdpCriticalShellProps) {
  return (
    <section className={styles.shell} data-ogabassey-pdp-critical-shell>
      <div className={styles.inner}>
        <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
          <Link href={buildPath(basePath, '/')}>Home</Link>
          <span aria-hidden="true">/</span>
          <Link href={buildPath(basePath, `/${product.categorySlug}`)}>
            {product.categoryName}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>
        <div className={styles.grid}>
          <div className={styles.imageFrame}>
            <Image
              alt={product.name}
              className={styles.image}
              decoding="sync"
              fetchPriority="high"
              fill
              loader={imageLoader}
              priority
              quality={OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY}
              sizes={OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}
              src={product.image}
            />
            <span className={styles.condition}>{product.condition}</span>
          </div>
          <div className={styles.summary}>
            <p className={styles.brand}>{product.brand}</p>
            <h1 className={styles.title}>{product.name}</h1>
            <div className={styles.ratingRow}>
              <span className={styles.stars} aria-hidden="true">
                ★★★★★
              </span>
              <span className={styles.reviewCount}>
                {product.reviewCount} Reviews
              </span>
            </div>
            <div className={styles.price}>{formatPrice(product.price)}</div>
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
