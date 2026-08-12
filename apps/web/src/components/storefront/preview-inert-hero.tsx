import { AnimatedWrapper } from '@/components/builder/animated-wrapper';

export type PreviewInertHeroProps = {
  align?: 'center' | 'left' | 'right';
  animationDelay?: number;
  animationDuration?: 'fast' | 'normal' | 'slow';
  animationTrigger?: 'immediate' | 'scroll' | 'onload';
  animationType?:
    | 'none'
    | 'fade-in'
    | 'slide-up'
    | 'slide-down'
    | 'slide-left'
    | 'slide-right'
    | 'zoom-in'
    | 'scale-up';
  backgroundGradient?: string;
  backgroundImage?: string;
  ctaText?: string;
  headingLevel?: 'h1' | 'h2' | 'div';
  image?: string;
  overlay?: boolean;
  padding?: 'large' | 'medium' | 'small';
  subtitle?: string;
  title?: string;
};

const alignClasses = {
  center: 'text-center',
  left: 'text-left',
  right: 'text-right',
} as const;

const paddingClasses = {
  large: 'py-32',
  medium: 'py-24',
  small: 'py-12',
} as const;

export function PreviewInertHero({
  align = 'center',
  animationDelay = 0,
  animationDuration = 'normal',
  animationTrigger = 'scroll',
  animationType = 'none',
  backgroundGradient,
  backgroundImage,
  ctaText,
  headingLevel = 'h1',
  overlay = false,
  padding = 'medium',
  subtitle,
  title,
}: PreviewInertHeroProps) {
  const Heading = headingLevel;
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
        aria-label="Preview hero"
        className={`relative ${alignClasses[align]} ${paddingClasses[padding]}${overlay && backgroundImage ? ' text-store-background' : backgroundGradient ? ' text-store-background' : ''}`}
        data-animation-delay={animationDelay}
        data-animation-duration={animationDuration}
        data-animation-trigger={animationTrigger}
        data-animation-type={animationType}
        style={
          backgroundImage || backgroundGradient
            ? {
                backgroundImage: backgroundImage
                  ? `url(${backgroundImage})`
                  : backgroundGradient,
                backgroundPosition: 'center',
                backgroundSize: 'cover',
              }
            : undefined
        }
      >
        {(overlay && backgroundImage) || backgroundGradient ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-black/60"
            data-testid="builder-preview-hero-overlay"
          />
        ) : null}
        <div className="relative z-10">
          <Heading>{title}</Heading>
          {subtitle ? <p>{subtitle}</p> : null}
          {ctaText ? (
            <button aria-disabled="true" disabled type="button">
              {ctaText}
            </button>
          ) : null}
        </div>
      </section>
    </AnimatedWrapper>
  );
}
