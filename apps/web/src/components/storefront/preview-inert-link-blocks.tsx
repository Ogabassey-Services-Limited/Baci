import type { ReactNode } from 'react';

type PreviewLink = {
  label: string;
};

type PreviewHeaderProps = {
  ctaButton?: { show: boolean; text: string };
  navigationLinks?: PreviewLink[];
  showLogo?: boolean;
  storeName?: string;
};

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
  brandName?: string;
  quickLinks?: PreviewLink[];
  showQuickLinks?: boolean;
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
  navigationLinks = [],
  showLogo = true,
  storeName = 'Preview Store',
}: PreviewHeaderProps) {
  return (
    <header data-testid="builder-preview-inert-header">
      {showLogo ? <strong>{storeName}</strong> : null}
      <nav aria-label="Preview navigation">
        {navigationLinks.map((link) => (
          <span key={link.label}>{link.label}</span>
        ))}
      </nav>
      {ctaButton?.show ? <InertAction>{ctaButton.text}</InertAction> : null}
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
  const firstSlide = slides[0];
  return (
    <section aria-label="Preview hero carousel">
      <h2>{firstSlide?.title}</h2>
      {firstSlide?.subtitle ? <p>{firstSlide.subtitle}</p> : null}
      {firstSlide?.ctaText ? (
        <InertAction>{firstSlide.ctaText}</InertAction>
      ) : null}
    </section>
  );
}

function PreviewButton({ text }: PreviewButtonProps) {
  return <InertAction>{text}</InertAction>;
}

function PreviewFooter({
  brandName = 'Preview Store',
  quickLinks = [],
  showQuickLinks = true,
}: PreviewFooterProps) {
  return (
    <footer data-testid="builder-preview-inert-footer">
      <strong>{brandName}</strong>
      {showQuickLinks ? (
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
