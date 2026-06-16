'use client';

import {
  Gamepad2,
  Headphones,
  Laptop,
  Package,
  Printer,
  Smartphone,
  Watch,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { normalizeStorefrontCategorySlug } from '@/lib/normalize-storefront-category-slug';

interface NavigationCategory {
  name: string;
  slug: string;
}

interface NavbarCategoryDropdownProps {
  basePath: string;
  categories: NavigationCategory[];
  dropdownId: string;
  onClose: () => void;
}

function getCategoryIcon(categoryName: string) {
  const name = categoryName.toLowerCase();
  if (name.includes('phone') || name.includes('smartphone')) {
    return Smartphone;
  }
  if (name.includes('laptop') || name.includes('computer')) {
    return Laptop;
  }
  if (name.includes('gaming') || name.includes('game')) {
    return Gamepad2;
  }
  if (
    name.includes('accessory') ||
    name.includes('audio') ||
    name.includes('speaker') ||
    name.includes('headphone')
  ) {
    return Headphones;
  }
  if (name.includes('printer')) {
    return Printer;
  }
  if (name.includes('tablet')) {
    return Laptop;
  }
  if (name.includes('watch') || name.includes('wearable')) {
    return Watch;
  }
  return Package;
}

export function NavbarCategoryDropdown({
  basePath,
  categories,
  dropdownId,
  onClose,
}: NavbarCategoryDropdownProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <section
      className="ogabassey-navbar-secondary__dropdown"
      id={dropdownId}
      aria-label="Category navigation"
    >
      <div className="ogabassey-navbar-secondary__dropdown-caret" />
      {categories.length > 0 ? (
        categories.map((category) => {
          const Icon = getCategoryIcon(category.name);
          const normalizedCategorySlug = normalizeStorefrontCategorySlug(
            category.slug
          );

          if (!normalizedCategorySlug) {
            return null;
          }

          return (
            <Link
              key={category.slug}
              href={`${basePath}/${encodeURIComponent(normalizedCategorySlug)}` as `/${string}`}
              prefetch={false}
              onClick={onClose}
              className="ogabassey-navbar-secondary__dropdown-link"
            >
              <Icon
                size={18}
                className="ogabassey-navbar-secondary__dropdown-icon"
                aria-hidden="true"
              />
              <span className="ogabassey-navbar-secondary__dropdown-label">
                {category.name}
              </span>
            </Link>
          );
        })
      ) : (
        <div className="ogabassey-navbar-secondary__dropdown-empty">
          Loading categories…
        </div>
      )}
    </section>
  );
}
