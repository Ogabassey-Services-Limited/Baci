'use client';

import { ChevronRight, Home } from 'lucide-react';
import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  separator?: 'slash' | 'chevron' | 'arrow';
  className?: string;
  showHome?: boolean;
}

export function Breadcrumbs({
  items,
  separator = 'chevron',
  className,
  showHome = true,
}: BreadcrumbsProps) {
  const separatorElement = {
    slash: <span className="mx-2 text-muted-foreground">/</span>,
    chevron: (
      <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground shrink-0" />
    ),
    arrow: <span className="mx-2 text-muted-foreground">→</span>,
  };

  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', href: '/' }, ...items]
    : items;

  return (
    <nav aria-label="Breadcrumb" className={cn('py-3', className)}>
      <ol className="flex flex-wrap items-center text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          const isHome = index === 0 && showHome;

          return (
            <li key={item.label} className="flex items-center">
              {index > 0 && separatorElement[separator]}
              {isLast ? (
                <span
                  className="text-muted-foreground font-medium truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <Link
                  href={asRoute(item.href)}
                  className={cn(
                    'text-foreground hover:text-store-primary transition-colors',
                    isHome && 'flex items-center gap-1'
                  )}
                >
                  {isHome && <Home className="h-4 w-4" />}
                  <span className={isHome ? 'sr-only sm:not-sr-only' : ''}>
                    {item.label}
                  </span>
                </Link>
              ) : (
                <span className="text-foreground">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
