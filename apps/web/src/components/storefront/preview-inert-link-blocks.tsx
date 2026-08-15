import type { ReactNode } from 'react';
import { AnimatedWrapper } from '@/components/builder/animated-wrapper';
import { PreviewInertHeader } from './preview-inert-header';
import {
  PreviewInertHero,
  type PreviewInertHeroProps,
} from './preview-inert-hero';

type PreviewLink = {
  label: string;
};

type PreviewCarouselProps = {
  slides?: PreviewInertHeroProps[];
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
  quickLinksLabel?: string;
  showNewsletter?: boolean;
  showQuickLinks?: boolean;
  socialLinks?: Record<string, string>;
  socialLinksLabel?: string;
  textColor?: string;
};
type PreviewFaqProps = Pick<
  PreviewInertHeroProps,
  'animationDelay' | 'animationDuration' | 'animationTrigger' | 'animationType'
> & {
  items?: { answer?: string; question?: string }[];
  style?: 'accordion' | 'grid' | 'list';
  subtitle?: string;
  title?: string;
};

type PreviewPlaceholderProps = {
  label?: string;
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

function PreviewHeroCarousel({ slides = [] }: PreviewCarouselProps) {
  const activeIndex = slides.length > 0 ? 0 : -1;
  const activeSlide = activeIndex >= 0 ? slides[activeIndex] : undefined;

  return (
    <section
      aria-label="Preview hero carousel"
      className="relative h-[60vh] w-full overflow-hidden"
      data-slide-count={slides.length}
      data-active-slide-index={activeIndex}
    >
      {activeSlide ? (
        <article
          className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-store-primary-text"
          data-slide-index={activeIndex}
          key={`${activeIndex}:${activeSlide.title ?? ''}:${activeSlide.subtitle ?? ''}:${activeSlide.ctaText ?? ''}`}
          style={
            activeSlide.image
              ? {
                  backgroundImage: `url(${activeSlide.image})`,
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }
              : undefined
          }
        >
          {activeSlide.image ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-linear-to-t from-store-foreground/90 via-store-foreground/40 to-transparent"
            />
          ) : null}
          <div className="relative z-10">
            <h2>{activeSlide.title}</h2>
            {activeSlide.subtitle ? <p>{activeSlide.subtitle}</p> : null}
            {activeSlide.ctaText ? (
              <InertAction>{activeSlide.ctaText}</InertAction>
            ) : null}
          </div>
        </article>
      ) : null}
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
  quickLinksLabel = 'Quick links',
  showNewsletter = false,
  showQuickLinks = true,
  socialLinks = {},
  socialLinksLabel = 'Follow us',
  textColor,
}: PreviewFooterProps) {
  const socialPlatforms = Object.entries(socialLinks).flatMap(
    ([platform, url]) => (url ? [platform] : [])
  );
  return (
    <footer
      data-testid="builder-preview-inert-footer"
      style={{
        backgroundColor: backgroundColor ?? 'var(--theme-footer-bg)',
        color: textColor ?? 'var(--theme-footer-text)',
      }}
    >
      <strong>{brandName}</strong>
      <p>{copyrightText}</p>
      {showQuickLinks && quickLinks.length > 0 ? (
        <nav aria-label="Preview footer navigation">
          <h2>{quickLinksLabel}</h2>
          {quickLinks.map((link) => (
            <span key={link.label}>{link.label}</span>
          ))}
        </nav>
      ) : null}
      {socialPlatforms.length > 0 ? (
        <section aria-label="Preview social links">
          <h2>{socialLinksLabel}</h2>
          {socialPlatforms.map((platform) => (
            <span key={platform}>{platform}</span>
          ))}
        </section>
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
  animationDelay = 0,
  animationDuration = 'normal',
  animationTrigger = 'scroll',
  animationType = 'none',
  items = [],
  style = 'accordion',
  subtitle,
  title,
}: PreviewFaqProps) {
  return (
    <AnimatedWrapper
      animation={{
        delay: animationDelay,
        duration: animationDuration,
        trigger: animationTrigger === 'onload' ? 'immediate' : animationTrigger,
        type: animationType,
      }}
    >
      <section
        aria-label="Preview FAQ"
        data-animation-delay={animationDelay}
        data-animation-duration={animationDuration}
        data-animation-trigger={animationTrigger}
        data-animation-type={animationType}
      >
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
        <div className={previewFaqStyleClasses[style]} data-style={style}>
          {items.map((item) =>
            style === 'accordion' ? (
              <details key={item.question}>
                <summary>{item.question}</summary>
                {item.answer ? <p>{item.answer}</p> : null}
              </details>
            ) : (
              <article key={item.question}>
                <h3>{item.question}</h3>
                {item.answer ? <p>{item.answer}</p> : null}
              </article>
            )
          )}
        </div>
      </section>
    </AnimatedWrapper>
  );
}

function PreviewPlaceholder({
  label = 'Saved section',
}: PreviewPlaceholderProps) {
  return (
    <section
      aria-label={`${label} preview placeholder`}
      className="border border-dashed border-current/20 px-4 py-8 text-center text-sm"
      data-testid="builder-preview-refused-placeholder"
    >
      {label}
    </section>
  );
}

export const previewInertLinkBlocks = {
  Button: { render: PreviewButton },
  Footer: { render: PreviewFooter },
  FAQ: { render: PreviewFAQ },
  Header: { render: PreviewInertHeader },
  Hero: { render: PreviewInertHero },
  HeroCarousel: { render: PreviewHeroCarousel },
  PreviewPlaceholder: { render: PreviewPlaceholder },
};
