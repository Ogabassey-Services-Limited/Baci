import { AnimatedWrapper, type AnimationType } from './animated-wrapper';
import { renderIcon } from './icon-registry';

export type FeaturesComponentProps = {
  title: string;
  subtitle?: string;
  features: { title: string; description: string; icon?: string }[];
  columns?: number;
  animationType?: string;
  animationDuration?: string;
  animationDelay?: number;
  animationTrigger?: string;
};

function getAnimationType(type: string | undefined): AnimationType {
  const types: Record<string, AnimationType> = {
    fade: 'fade-in',
    slide: 'slide-up',
    zoom: 'zoom-in',
    none: 'none',
  };
  return types[type ?? 'none'] ?? 'none';
}

export function FeaturesComponent({
  title,
  subtitle,
  features,
  columns = 3,
  animationType,
  animationDuration,
  animationDelay,
  animationTrigger,
}: FeaturesComponentProps) {
  return (
    <AnimatedWrapper
      animation={{
        type: getAnimationType(animationType),
        duration: animationDuration as 'fast' | 'normal' | 'slow',
        delay: animationDelay,
        trigger:
          animationTrigger === 'onload'
            ? 'immediate'
            : (animationTrigger as 'scroll' | 'immediate'),
      }}
    >
      <section className="py-12 container px-4 md:px-6 bg-muted/30">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{title}</h2>
          {subtitle && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-${columns} gap-8`}>
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center text-center p-6 bg-background text-foreground rounded-lg shadow-sm"
            >
              <div
                className="size-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary"
                aria-hidden="true"
              >
                {renderIcon(feature.icon || 'check', { className: 'w-6 h-6' })}
              </div>
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>
    </AnimatedWrapper>
  );
}
