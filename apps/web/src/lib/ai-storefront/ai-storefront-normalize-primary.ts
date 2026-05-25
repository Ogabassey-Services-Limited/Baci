import type { AiStorefrontComponent } from '@/schemas/ai-storefront-layout';
import {
  defaultFooter,
  defaultHeader,
  defaultHero,
  defaultLinks,
  defaultProductGrid,
} from './ai-storefront-normalize-defaults';
import {
  normalizeCtaButton,
  normalizeLinks,
} from './ai-storefront-normalize-shared';
import {
  asRecord,
  bool,
  componentId,
  type FooterComponent,
  integerInRange,
  parseComponent,
  pickLiteral,
  safeHref,
  text,
} from './ai-storefront-normalize-types';

export function normalizeHeader(
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback = defaultHeader();
  const ctaButton = normalizeCtaButton(props.ctaButton ?? props.cta_button);

  return parseComponent(
    {
      type: 'Header',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'header', index),
        showLogo: bool(
          props.showLogo ?? props.show_logo,
          fallback.props.showLogo
        ),
        showSearch: bool(
          props.showSearch ?? props.show_search,
          fallback.props.showSearch
        ),
        showCart: bool(
          props.showCart ?? props.show_cart,
          fallback.props.showCart
        ),
        showMenu: bool(
          props.showMenu ?? props.show_menu,
          fallback.props.showMenu
        ),
        sticky: bool(props.sticky, fallback.props.sticky),
        navigationLinks: normalizeLinks(
          props.navigationLinks ?? props.navigation_links ?? props.navigation,
          fallback.props.navigationLinks ?? defaultLinks(),
          6
        ),
        ctaButton: ctaButton ?? fallback.props.ctaButton,
        layout: pickLiteral(
          props.layout,
          [
            'logo-left-nav-center',
            'logo-left-nav-right',
            'logo-center',
          ] as const,
          fallback.props.layout
        ),
        searchStyle: pickLiteral(
          props.searchStyle ?? props.search_style,
          ['outline', 'filled', 'minimal'] as const,
          fallback.props.searchStyle
        ),
        searchRadius: pickLiteral(
          props.searchRadius ?? props.search_radius,
          ['none', 'sm', 'md', 'full'] as const,
          fallback.props.searchRadius
        ),
        paddingY: pickLiteral(
          props.paddingY ?? props.padding_y,
          ['sm', 'md', 'lg'] as const,
          fallback.props.paddingY
        ),
        glassEffect: bool(
          props.glassEffect ?? props.glass_effect,
          fallback.props.glassEffect
        ),
      },
    },
    fallback
  );
}

export function normalizeHero(
  businessName: string,
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback = defaultHero(businessName);
  const ctaButton = normalizeCtaButton(props.ctaButton ?? props.cta_button);

  return parseComponent(
    {
      type: 'Hero',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'hero', index),
        title:
          text(props.title ?? props.headline ?? props.heading, 120) ??
          fallback.props.title,
        subtitle:
          text(props.subtitle ?? props.description ?? props.body, 240) ??
          fallback.props.subtitle,
        ctaText:
          text(props.ctaText ?? props.cta_text, 120) ??
          ctaButton?.text ??
          fallback.props.ctaText,
        ctaLink:
          safeHref(props.ctaLink ?? props.cta_link) ??
          ctaButton?.url ??
          fallback.props.ctaLink,
        backgroundImage:
          safeHref(props.backgroundImage ?? props.background_image) ??
          undefined,
        overlay: bool(props.overlay, fallback.props.overlay),
        align: pickLiteral(
          props.align,
          ['left', 'center', 'right'] as const,
          fallback.props.align
        ),
        padding: pickLiteral(
          props.padding,
          ['small', 'medium', 'large'] as const,
          fallback.props.padding
        ),
        headingLevel: pickLiteral(
          props.headingLevel ?? props.heading_level,
          ['h1', 'h2', 'div'] as const,
          fallback.props.headingLevel
        ),
      },
    },
    fallback
  );
}

export function normalizeProductGrid(
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback = defaultProductGrid();

  return parseComponent(
    {
      type: 'ProductGrid',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'product-grid', index),
        title: text(props.title ?? props.heading, 120) ?? fallback.props.title,
        columns: integerInRange(props.columns, fallback.props.columns, 1, 4),
        limit: integerInRange(props.limit, fallback.props.limit, 4, 12),
        category: text(props.category, 80),
        sortBy: pickLiteral(
          props.sortBy ?? props.sort_by,
          ['newest', 'price-low', 'price-high', 'name'] as const,
          fallback.props.sortBy
        ),
        showFilters: bool(
          props.showFilters ?? props.show_filters,
          fallback.props.showFilters
        ),
      },
    },
    fallback
  );
}

function normalizeSocialLinks(
  value: unknown
): FooterComponent['props']['socialLinks'] {
  const record = asRecord(value);
  const socialLinks = {
    facebook: safeHref(record.facebook),
    instagram: safeHref(record.instagram),
    twitter: safeHref(record.twitter),
    linkedin: safeHref(record.linkedin),
    youtube: safeHref(record.youtube),
  };

  return Object.values(socialLinks).some(Boolean) ? socialLinks : {};
}

export function normalizeFooter(
  businessName: string,
  props: Record<string, unknown>,
  index: number
): AiStorefrontComponent {
  const fallback = defaultFooter(businessName);
  const quickLinks = normalizeLinks(
    props.quickLinks ?? props.quick_links ?? props.links,
    fallback.props.quickLinks ?? [],
    8
  );

  return parseComponent(
    {
      type: 'Footer',
      props: {
        ...fallback.props,
        id: componentId(props.id, 'footer', index),
        copyrightText:
          text(
            props.copyrightText ??
              props.copyright_text ??
              props.copyright ??
              props.business_name,
            120
          ) ?? fallback.props.copyrightText,
        showQuickLinks: bool(
          props.showQuickLinks ?? props.show_quick_links,
          quickLinks.length > 0
        ),
        quickLinks,
        socialLinks: normalizeSocialLinks(
          props.socialLinks ?? props.social_links
        ),
        showNewsletter: bool(
          props.showNewsletter ?? props.show_newsletter,
          fallback.props.showNewsletter
        ),
      },
    },
    fallback
  );
}
