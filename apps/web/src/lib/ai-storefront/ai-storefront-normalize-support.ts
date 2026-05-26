import type { AiStorefrontComponent } from '@/schemas/ai-storefront-layout';
import {
  defaultFeatureItems,
  defaultTrustBadges,
} from './ai-storefront-normalize-defaults';
import {
  normalizeCtaButton,
  normalizeFeatureItems,
} from './ai-storefront-normalize-shared';
import {
  componentId,
  type FeaturesComponent,
  type NewsletterComponent,
  parseComponent,
  pickLiteral,
  pickNumberLiteral,
  type TrustBadgesComponent,
  text,
} from './ai-storefront-normalize-types';

export function normalizeFeatures(
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback: FeaturesComponent = {
    type: 'Features',
    props: {
      id: 'features',
      title: 'Why shop with us',
      subtitle: 'Simple reasons customers choose this store.',
      columns: 3,
      features: defaultFeatureItems(),
    },
  };

  return parseComponent(
    {
      type: 'Features',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'features', index),
        title: text(props.title, 120) ?? fallback.props.title,
        subtitle:
          text(props.subtitle ?? props.description, 240) ??
          fallback.props.subtitle,
        columns: pickNumberLiteral(
          props.columns,
          [2, 3, 4] as const,
          fallback.props.columns
        ),
        features: normalizeFeatureItems(
          props.features ?? props.items,
          fallback.props.features,
          6
        ),
      },
    },
    fallback
  );
}

export function normalizeTrustBadges(
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback: TrustBadgesComponent = {
    type: 'TrustBadges',
    props: {
      id: 'trust-badges',
      badges: defaultTrustBadges(),
      layout: 'horizontal',
      style: 'cards',
    },
  };

  return parseComponent(
    {
      type: 'TrustBadges',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'trust-badges', index),
        badges: normalizeFeatureItems(
          props.badges ?? props.items,
          fallback.props.badges,
          4
        ),
        layout: pickLiteral(
          props.layout,
          ['horizontal', 'grid'] as const,
          fallback.props.layout
        ),
        style: pickLiteral(
          props.style,
          ['cards', 'minimal', 'icons-only'] as const,
          fallback.props.style
        ),
      },
    },
    fallback
  );
}

export function normalizeNewsletter(
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback: NewsletterComponent = {
    type: 'Newsletter',
    props: {
      id: 'newsletter',
      title: 'Get updates',
      description: 'Be first to hear about new products and offers.',
      placeholder: 'Enter your email',
      buttonText: 'Subscribe',
    },
  };
  const ctaButton = normalizeCtaButton(props.ctaButton ?? props.cta_button);

  return parseComponent(
    {
      type: 'Newsletter',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'newsletter', index),
        title: text(props.title, 120) ?? fallback.props.title,
        description:
          text(props.description ?? props.subtitle, 240) ??
          fallback.props.description,
        placeholder:
          text(
            props.placeholder ?? props.inputField ?? props.input_field,
            80
          ) ?? fallback.props.placeholder,
        buttonText:
          text(props.buttonText ?? props.button_text, 120) ??
          ctaButton?.text ??
          fallback.props.buttonText,
      },
    },
    fallback
  );
}
