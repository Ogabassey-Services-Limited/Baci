import Link from 'next/link';
import { asRoute } from '@/lib/routes';
import type { StorefrontLinkModule } from '@/lib/storefront-link-modules/link-module-types';

interface StorefrontLinkModulesSectionProps {
  modules: StorefrontLinkModule[];
  pathPrefix: string;
}

function resolveHref(pathPrefix: string, href: string) {
  return href === '/' ? pathPrefix || '/' : `${pathPrefix}${href}`;
}

export function StorefrontLinkModulesSection({
  modules,
  pathPrefix,
}: StorefrontLinkModulesSectionProps) {
  const visibleModules = modules.filter((module) => module.items.length > 0);

  if (visibleModules.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="storefront-link-modules-heading"
      className="mt-8 rounded-3xl border border-store-background-text/10 bg-store-background p-5 shadow-sm"
    >
      <div className="max-w-3xl space-y-2">
        <h2
          id="storefront-link-modules-heading"
          className="text-lg font-semibold text-store-background-text"
        >
          Explore Ogabassey buying paths
        </h2>
        <p className="text-sm leading-6 text-store-background-text/65">
          Maintained category, comparison, guide, and catalog page links for
          shoppers researching Ogabassey products.
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {visibleModules.map((module) => (
          <section key={module.id} aria-labelledby={`${module.id}-heading`}>
            <h3
              id={`${module.id}-heading`}
              className="text-sm font-semibold text-store-background-text"
            >
              {module.title}
            </h3>
            <p className="mt-1 text-xs leading-5 text-store-background-text/55">
              {module.description}
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {module.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={asRoute(resolveHref(pathPrefix, item.href))}
                    prefetch={false}
                    className="text-sm font-medium text-store-primary underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
