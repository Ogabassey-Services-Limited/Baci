import {
  MAX_AI_COPY_LENGTH,
  MAX_AI_LABEL_LENGTH,
  MAX_AI_URL_LENGTH,
} from '@baci/shared/contracts';

export function getBuilderAiSpecialOperationGuidance() {
  return {
    updateCarouselSlide: {
      ctaLink: { maximumLength: MAX_AI_URL_LENGTH },
      ctaText: { maximumLength: MAX_AI_LABEL_LENGTH },
      subtitle: { maximumLength: MAX_AI_COPY_LENGTH },
      title: { maximumLength: MAX_AI_LABEL_LENGTH },
    },
    updateRoot: { title: { maximumLength: MAX_AI_LABEL_LENGTH } },
  };
}
