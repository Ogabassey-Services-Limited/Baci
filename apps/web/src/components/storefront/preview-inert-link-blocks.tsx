import type { ReactNode } from 'react';

type PreviewLink = {
  label: string;
};

type PreviewHeaderProps = {
  ctaButton?: { show: boolean; text: string };
  layout?: PreviewHeaderLayout;
  navigationLinks?: PreviewLink[];
  paddingY?: 'sm' | 'md' | 'lg';
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
  align?: 'center' | 'left' | 'right';
  backgroundImage?: string;
  ctaText?: string;
  headingLevel?: 'h1' | 'h2' | 'div';
  overlay?: boolean;
  padding?: 'large' | 'medium' | 'small';
  subtitle?: string;
  title?: string;
};

type PreviewCarouselProps = {
  slides?: PreviewHeroProps[];
};

type PreviewButtonProps = {
  align?: PreviewButtonAlign;
  size?: PreviewButtonSize;
  text?: string;
  variant?: PreviewButtonVariant;
};

type PreviewButtonAlign = 'left' | 'center' | 'right';

type PreviewButtonSize = 'sm' | 'default' | 'lg';

type PreviewButtonVariant = 'primary' | 'background' | 'accent';

type PreviewFooterProps = {
  backgroundColor?: string;
  brandName?: string;
  copyrightText?: string;
  quickLinks?: PreviewLink[];
  showNewsletter?: boolean;
  showQuickLinks?: boolean;
  textColor?: string;
};
type PreviewFaqProps = {
  items?: { answer?: string; question?: string }[];
  style?: 'accordion' | 'grid' | 'list';
  subtitle?: string;
  title?: string;
};

const previewButtonAlignClasses: Record<PreviewButtonAlign, string> = {
  center: 'justify-center',
  left: 'justify-start',
  right: 'justify-end',
};

const previewButtonSizeClasses: Record<PreviewButtonSize, string> = {
  default: 'h-9 px-4 py-2 text-sm',
  lg: 'h-10 px-6 py-3 text-base',
  sm: 'h-8 px-3 text-sm',
};

const previewButtonVariantClasses: Record<PreviewButtonVariant, string> = {
  accent: 'bg-store-accent text-store-accent-text',
  background: 'bg-store-background text-store-background-text',
  primary: 'bg-store-primary text-store-primary-text',
};

const previewHeaderLayoutClasses: Record<PreviewHeaderLayout, string> = {
  'logo-center': 'grid grid-cols-3 items-center gap-3',
  'logo-left-nav-center': 'grid grid-cols-[auto_1fr_auto] items-center gap-3',
  'logo-left-nav-right': 'flex items-center gap-3',
};
const previewHeroAlignClasses = {
  center: 'text-center',
  left: 'text-left',
  right: 'text-right',
} as const;
const previewHeroPaddingClasses = {
  large: 'py-16',
  medium: 'py-10',
  small: 'py-6',
} as const;
const previewHeaderPaddingClasses = {
  lg: 'py-6',
  md: 'py-4',
  sm: 'py-2',
} as const;
const previewFaqStyleClasses = {
  accordion: 'space-y-3',
  grid: 'grid gap-4 sm:grid-cols-2',
  list: 'space-y-2',
} as const;

function InertAction({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button aria-disabled="true" className={className} disabled type="button">
      {children}
    </button>
  );
}

function PreviewHeader({
  ctaButton,
  layout = 'logo-left-nav-center',
  navigationLinks = [],
  paddingY = 'md',
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
      className={`${previewHeaderPaddingClasses[paddingY]} ${previewHeaderLayoutClasses[layout]}${
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

function PreviewHero({
  align = 'center',
  backgroundImage,
  ctaText,
  headingLevel = 'h1',
  overlay = false,
  padding = 'medium',
  subtitle,
  title,
}: PreviewHeroProps) {
  const Heading = headingLevel;
  return (
    <section
      aria-label="Preview hero"
      className={`${previewHeroAlignClasses[align]} ${previewHeroPaddingClasses[padding]}${overlay ? ' bg-black/40 text-white' : ''}`}
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${backgroundImage})`,
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }
          : undefined
      }
    >
      <Heading>{title}</Heading>
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

function PreviewButton({
  align = 'center',
  size = 'default',
  text,
  variant = 'primary',
}: PreviewButtonProps) {
  return (
    <div
      className={`container flex px-4 py-4 md:px-6 ${previewButtonAlignClasses[align]}`}
      data-align={align}
      data-size={size}
      data-testid="builder-preview-inert-button"
      data-variant={variant}
    >
      <InertAction
        className={`${previewButtonSizeClasses[size]} ${previewButtonVariantClasses[variant]}`}
      >
        {text}
      </InertAction>
    </div>
  );
}

function PreviewFooter({
  backgroundColor,
  brandName = 'Preview Store',
  copyrightText = '© Store. All rights reserved.',
  quickLinks = [],
  showNewsletter = false,
  showQuickLinks = true,
  textColor,
}: PreviewFooterProps) {
  return (
    <footer
      data-testid="builder-preview-inert-footer"
      style={{ backgroundColor, color: textColor }}
    >
      <strong>{brandName}</strong>
      <p>{copyrightText}</p>
      {showQuickLinks && quickLinks.length > 0 ? (
        <nav aria-label="Preview footer navigation">
          {quickLinks.map((link) => (
            <span key={link.label}>{link.label}</span>
          ))}
        </nav>
      ) : null}
      {showNewsletter ? (
        <section aria-label="Preview newsletter">
          <h2>Newsletter</h2>
          <div className="flex gap-2">
            <input
              aria-label="Email address for newsletter"
              disabled
              placeholder="Your email"
              type="email"
            />
            <InertAction>Subscribe</InertAction>
          </div>
        </section>
      ) : null}
    </footer>
  );
}

function PreviewFAQ({
  items = [],
  style = 'accordion',
  subtitle,
  title,
}: PreviewFaqProps) {
  return (
    <section aria-label="Preview FAQ">
      <h2>{title}</h2>
      {subtitle ? <p>{subtitle}</p> : null}
      <div className={previewFaqStyleClasses[style]} data-style={style}>
        {items.map((item) => (
          <article key={item.question}>
            <h3>{item.question}</h3>
            {item.answer ? <p>{item.answer}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export const previewInertLinkBlocks = {
  Button: { render: PreviewButton },
  Footer: { render: PreviewFooter },
  FAQ: { render: PreviewFAQ },
  Header: { render: PreviewHeader },
  Hero: { render: PreviewHero },
  HeroCarousel: { render: PreviewHeroCarousel },
};
