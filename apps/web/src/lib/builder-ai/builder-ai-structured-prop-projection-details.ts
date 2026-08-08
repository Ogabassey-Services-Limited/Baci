import {
  builderAiFeatureIconNames,
  MAX_AI_COPY_LENGTH,
  MAX_AI_LABEL_LENGTH,
  MAX_AI_URL_LENGTH,
} from '@baci/shared/contracts';

export const builderAiStructuredPropProjectionDetails: Record<string, object> =
  {
    'Features.features': {
      maximumItems: 8,
      members: [
        {
          maximumLength: MAX_AI_LABEL_LENGTH,
          name: 'title',
          required: true,
          valueType: 'string',
        },
        {
          maximumLength: MAX_AI_COPY_LENGTH,
          name: 'description',
          required: true,
          valueType: 'string',
        },
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
        {
          maximumLength: MAX_AI_LABEL_LENGTH,
          name: 'label',
          required: true,
          valueType: 'string',
        },
        {
          maximumLength: MAX_AI_URL_LENGTH,
          name: 'url',
          required: true,
          valueType: 'safe-storefront-url',
        },
      ],
      uniqueBy: 'label',
    },
    'Header.ctaButton': {
      members: [
        { name: 'show', required: true, valueType: 'boolean' },
        {
          maximumLength: MAX_AI_LABEL_LENGTH,
          name: 'text',
          required: true,
          valueType: 'string',
        },
        {
          maximumLength: MAX_AI_URL_LENGTH,
          name: 'url',
          required: true,
          valueType: 'safe-storefront-url',
        },
      ],
    },
    'Header.navigationLinks': {
      maximumItems: 8,
      members: [
        {
          maximumLength: MAX_AI_LABEL_LENGTH,
          name: 'label',
          required: true,
          valueType: 'string',
        },
        {
          maximumLength: MAX_AI_URL_LENGTH,
          name: 'url',
          required: true,
          valueType: 'safe-storefront-url',
        },
      ],
      uniqueBy: 'label',
    },
  } as const;
