import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

interface HeaderNavigationProps {
  getHref: (path: string) => string;
  layout: 'logo-left-nav-center' | 'logo-left-nav-right' | 'logo-center';
  links: { label: string; url: string }[];
}

export function HeaderNavigation({
  getHref,
  layout,
  links,
}: HeaderNavigationProps) {
  return (
    <nav
      className={cn('hidden md:flex items-center gap-6', {
        'order-2 mx-auto': layout === 'logo-left-nav-center',
        'order-2 ml-auto mr-4': layout === 'logo-left-nav-right',
        'order-1 mr-auto': layout === 'logo-center',
      })}
    >
      {links.map((link) => (
        <Link
          key={link.label}
          href={asRoute(getHref(link.url))}
          className="text-sm font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
