'use client';

import { Search } from 'lucide-react';
import Image from 'next/image';
import { useEffect, useState } from 'react';

type PreviewLink = {
  label: string;
};

type PreviewHeaderLayout =
  | 'logo-left-nav-center'
  | 'logo-left-nav-right'
  | 'logo-center';

type PreviewHeaderProps = {
  backgroundImage?: string;
  backgroundColor?: string;
  ctaButton?: { show: boolean; text: string };
  glassEffect?: boolean;
  layout?: PreviewHeaderLayout;
  logoUrl?: string;
  navigationLinks?: PreviewLink[];
  paddingY?: 'sm' | 'md' | 'lg';
  searchRadius?: 'none' | 'sm' | 'md' | 'full';
  searchStyle?: 'outline' | 'filled' | 'minimal';
  showCart?: boolean;
  showAccount?: boolean;
  showLogo?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  sticky?: boolean;
  storeName?: string;
  textColor?: string;
};

const layoutClasses: Record<PreviewHeaderLayout, string> = {
  'logo-center': 'grid grid-cols-3 items-center gap-3',
  'logo-left-nav-center': 'grid grid-cols-[auto_1fr_auto] items-center gap-3',
  'logo-left-nav-right': 'flex items-center gap-3',
};

const paddingClasses = {
  lg: 'py-6',
  md: 'py-4',
  sm: 'py-2',
} as const;

const searchRadiusClasses = {
  full: 'rounded-full',
  md: 'rounded-md',
  none: 'rounded-none',
  sm: 'rounded-sm',
} as const;

const searchStyleClasses = {
  filled: 'border border-transparent bg-muted',
  minimal: 'border-0 bg-transparent',
  outline: 'border border-current bg-transparent',
} as const;

function InertHeaderAction({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <button aria-disabled="true" className={className} disabled type="button">
      {children}
    </button>
  );
}

export function PreviewInertHeader({
  backgroundImage,
  backgroundColor,
  ctaButton,
  glassEffect = false,
  layout = 'logo-left-nav-center',
  logoUrl,
  navigationLinks = [],
  paddingY = 'md',
  searchRadius = 'md',
  searchStyle = 'outline',
  showCart = false,
  showAccount = true,
  showLogo = true,
  showMenu = false,
  showSearch = false,
  sticky = false,
  storeName = 'Preview Store',
  textColor,
}: PreviewHeaderProps) {
  const isCenteredLayout = layout === 'logo-center';
  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledGlass = glassEffect && isScrolled;
  const effectiveTextColor =
    isScrolledGlass || !glassEffect ? textColor : undefined;
  const effectiveBackgroundColor = isScrolledGlass
    ? 'rgba(255, 255, 255, 0.8)'
    : glassEffect
      ? 'transparent'
      : backgroundColor;

  useEffect(() => {
    if (!glassEffect) {
      setIsScrolled(false);
      return;
    }

    const updateScrollState = () => {
      setIsScrolled(window.scrollY > 50);
    };

    updateScrollState();
    window.addEventListener('scroll', updateScrollState);
    return () => window.removeEventListener('scroll', updateScrollState);
  }, [glassEffect]);

  return (
    <header
      className={`${paddingClasses[paddingY]} ${layoutClasses[layout]}${
        sticky ? ' fixed left-0 right-0 top-0 z-10' : ' relative'
      }${isScrolledGlass ? ' backdrop-blur-md shadow-sm' : ''}${
        glassEffect && !isScrolled ? ' text-store-primary-text' : ''
      } z-0`}
      data-glass-effect={String(glassEffect)}
      data-layout={layout}
      data-scroll-state={isScrolledGlass ? 'scrolled' : 'top'}
      data-sticky={String(sticky)}
      data-testid="builder-preview-inert-header"
      style={{
        backgroundColor: effectiveBackgroundColor,
        color: effectiveTextColor,
      }}
    >
      {backgroundImage ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-20"
          data-testid="builder-preview-header-background"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
      ) : null}
      {showLogo ? (
        <strong
          className={
            isCenteredLayout ? 'col-start-2 justify-self-center' : undefined
          }
        >
          {logoUrl ? (
            <span className="flex items-center gap-2">
              <Image
                alt={`${storeName} logo`}
                height={40}
                src={logoUrl}
                width={120}
              />
              <span>{storeName}</span>
            </span>
          ) : (
            storeName
          )}
        </strong>
      ) : null}
      {showMenu && navigationLinks.length > 0 ? (
        <nav
          aria-label="Preview navigation"
          className={`hidden md:flex ${
            layout === 'logo-left-nav-right'
              ? 'ml-auto'
              : isCenteredLayout
                ? 'col-start-2 row-start-2 justify-self-center'
                : 'justify-self-center'
          }`}
        >
          {navigationLinks.map((link) => (
            <span key={link.label}>{link.label}</span>
          ))}
        </nav>
      ) : null}
      <div
        className={
          isCenteredLayout ? 'col-start-3 justify-self-end' : 'flex gap-2'
        }
      >
        {showSearch ? (
          <>
            <button
              aria-disabled="true"
              aria-label="Search"
              className="md:hidden"
              disabled
              type="button"
            >
              <Search aria-hidden="true" className="size-5" />
            </button>
            <button
              aria-disabled="true"
              aria-label="Search"
              className={`hidden md:inline-flex items-center gap-2 ${searchStyleClasses[searchStyle]} ${searchRadiusClasses[searchRadius]}`}
              data-search-radius={searchRadius}
              data-search-style={searchStyle}
              disabled
              type="button"
            >
              <Search aria-hidden="true" className="size-4" />
              Search...
            </button>
          </>
        ) : null}
        {showAccount ? (
          <InertHeaderAction className="hidden sm:inline-flex">
            Account
          </InertHeaderAction>
        ) : null}
        {showCart ? <InertHeaderAction>Cart</InertHeaderAction> : null}
        {showMenu ? <InertHeaderAction>Menu</InertHeaderAction> : null}
        {ctaButton?.show ? (
          <InertHeaderAction className="hidden sm:inline-flex">
            {ctaButton.text}
          </InertHeaderAction>
        ) : null}
      </div>
    </header>
  );
}
