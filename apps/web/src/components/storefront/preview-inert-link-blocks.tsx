import type { ReactNode } from 'react';

type PreviewLink = {
  label: string;
};

type PreviewHeaderProps = {
  ctaButton?: { show: boolean; text: string };
  layout?: PreviewHeaderLayout;
  navigationLinks?: PreviewLink[];
  showCart?: boolean;
  showLogo?: boolean;
  showMenu?: boolean;
  showSearch?: boolean;
  sticky?: boolean;
  storeName?: string;
};

type PreviewHeaderLayout =
  | 'logo-left-nav-center'
  | 'logo-left-nav-right'
  | 'logo-center';

type PreviewHeroProps = {
  ctaText?: string;
  subtitle?: string;
  title?: string;
};

type PreviewCarouselProps = {
  slides?: PreviewHeroProps[];
};

type PreviewButtonProps = {
  text?: string;
};

type PreviewFooterProps = {
  backgroundColor?: string;
  brandName?: string;
  quickLinks?: PreviewLink[];
  showQuickLinks?: boolean;
  textColor?: string;
};

const previewHeaderLayoutClasses: Record<PreviewHeaderLayout, string> = {
  'logo-center': 'grid grid-cols-3 items-center gap-3',
  'logo-left-nav-center': 'grid grid-cols-[auto_1fr_auto] items-center gap-3',
  'logo-left-nav-right': 'flex items-center gap-3',
};

function InertAction({ children }: { children: ReactNode }) {
  return (
    <button aria-disabled="true" disabled type="button">
      {children}
    </button>
  );
}

function PreviewHeader({
  ctaButton,
  layout = 'logo-left-nav-center',
  navigationLinks = [],
  showCart = false,
  showLogo = true,
  showMenu = false,
  showSearch = false,
  sticky = false,
  storeName = 'Preview Store',
}: PreviewHeaderProps) {
  const isCenteredLayout = layout === 'logo-center';
  return (
    <header
      className={`${previewHeaderLayoutClasses[layout]}${
        sticky ? ' sticky top-0 z-10' : ''
      }`}
      data-layout={layout}
      data-sticky={String(sticky)}
      data-testid="builder-preview-inert-header"
    >
      {showLogo ? (
        <strong
          className={
            isCenteredLayout ? 'col-start-2 justify-self-center' : undefined
          }
        >
          {storeName}
        </strong>
      ) : null}
      {navigationLinks.length > 0 ? (
        <nav
          aria-label="Preview navigation"
          className={
            layout === 'logo-left-nav-right'
              ? 'ml-auto'
              : isCenteredLayout
                ? 'col-start-2 row-start-2 justify-self-center'
                : 'justify-self-center'
          }
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
        {showSearch ? <InertAction>Search</InertAction> : null}
        {showCart ? <InertAction>Cart</InertAction> : null}
        {showMenu ? <InertAction>Menu</InertAction> : null}
        {ctaButton?.show ? <InertAction>{ctaButton.text}</InertAction> : null}
      </div>
    </header>
  );
}

function PreviewHero({ ctaText, subtitle, title }: PreviewHeroProps) {
  return (
    <section aria-label="Preview hero">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {ctaText ? <InertAction>{ctaText}</InertAction> : null}
    </section>
  );
}

function PreviewHeroCarousel({ slides = [] }: PreviewCarouselProps) {
  return (
    <section aria-label="Preview hero carousel">
      {slides.map((slide, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Bounded preview slides are static and have no intrinsic IDs.
        <article key={index}>
          <h2>{slide.title}</h2>
          {slide.subtitle ? <p>{slide.subtitle}</p> : null}
          {slide.ctaText ? <InertAction>{slide.ctaText}</InertAction> : null}
        </article>
      ))}
    </section>
  );
}

function PreviewButton({ text }: PreviewButtonProps) {
  return <InertAction>{text}</InertAction>;
}

function PreviewFooter({
  backgroundColor,
  brandName = 'Preview Store',
  quickLinks = [],
  showQuickLinks = true,
  textColor,
}: PreviewFooterProps) {
  return (
    <footer
      data-testid="builder-preview-inert-footer"
      style={{ backgroundColor, color: textColor }}
    >
      <strong>{brandName}</strong>
      {showQuickLinks && quickLinks.length > 0 ? (
        <nav aria-label="Preview footer navigation">
          {quickLinks.map((link) => (
            <span key={link.label}>{link.label}</span>
          ))}
        </nav>
      ) : null}
    </footer>
  );
}

export const previewInertLinkBlocks = {
  Button: { render: PreviewButton },
  Footer: { render: PreviewFooter },
  Header: { render: PreviewHeader },
  Hero: { render: PreviewHero },
  HeroCarousel: { render: PreviewHeroCarousel },
};
