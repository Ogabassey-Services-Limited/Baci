import { ArrowRight, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type React from 'react';
import { asRoute } from '@/lib/routes';

interface CartEmptyStateProps {
  basePath: string;
}

function normalizeBasePath(basePath: string): string {
  const trimmedBasePath = basePath.trim();

  if (!trimmedBasePath || trimmedBasePath === '/') {
    return '';
  }

  return `/${trimmedBasePath.replace(/^\/+|\/+$/g, '')}`;
}

function getStorefrontLink(basePath: string, path = '') {
  const normalizedBasePath = normalizeBasePath(basePath);
  return asRoute(`${normalizedBasePath}${path}` || '/');
}

export const CartEmptyState: React.FC<CartEmptyStateProps> = ({ basePath }) => {
  return (
    <section
      aria-labelledby="ogabassey-cart-empty-title"
      className="ogabassey-cart-empty-state"
    >
      <div className="ogabassey-cart-empty-state__visual" aria-hidden="true">
        <ShoppingCart size={54} strokeWidth={1.8} />
        <span className="ogabassey-cart-empty-state__visual-dot" />
        <span className="ogabassey-cart-empty-state__visual-line" />
      </div>

      <p className="ogabassey-cart-empty-state__eyebrow">
        Nothing in your cart yet
      </p>

      <h2 id="ogabassey-cart-empty-title">Your cart is empty</h2>

      <p className="ogabassey-cart-empty-state__description">
        Add phones, accessories, or repair services to compare totals and check
        out when ready.
      </p>

      <div className="ogabassey-cart-empty-state__actions">
        <Link
          href={getStorefrontLink(basePath)}
          className="ogabassey-cart-empty-state__primary-action"
        >
          Start shopping
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
        <Link
          href={getStorefrontLink(basePath, '/smartphones')}
          className="ogabassey-cart-empty-state__secondary-action"
        >
          Browse smartphones
        </Link>
      </div>
    </section>
  );
};
