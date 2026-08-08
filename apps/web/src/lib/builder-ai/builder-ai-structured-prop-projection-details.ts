import { builderAiFeatureIconNames } from '@baci/shared/contracts';

export const builderAiStructuredPropProjectionDetails: Record<string, object> =
  {
    'Features.features': {
      maximumItems: 8,
      members: [
        { name: 'title', required: true, valueType: 'string' },
        { name: 'description', required: true, valueType: 'string' },
        {
          allowedValues: builderAiFeatureIconNames,
          name: 'icon',
          required: false,
          valueType: 'string',
        },
      ],
      minimumItems: 1,
      uniqueBy: 'title',
    },
    'Footer.quickLinks': {
      maximumItems: 8,
      members: [
        { name: 'label', required: true, valueType: 'string' },
        { name: 'url', required: true, valueType: 'safe-storefront-url' },
      ],
      uniqueBy: 'label',
    },
    'Header.ctaButton': {
      members: [
        { name: 'show', required: true, valueType: 'boolean' },
        { name: 'text', required: true, valueType: 'string' },
        { name: 'url', required: true, valueType: 'safe-storefront-url' },
      ],
    },
    'Header.navigationLinks': {
      maximumItems: 8,
      members: [
        { name: 'label', required: true, valueType: 'string' },
        { name: 'url', required: true, valueType: 'safe-storefront-url' },
      ],
      uniqueBy: 'label',
    },
  } as const;
