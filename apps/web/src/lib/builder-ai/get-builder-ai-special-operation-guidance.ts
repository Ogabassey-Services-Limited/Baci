import {
  builderDesignCapabilities,
  builderDesignCapabilityAdapter,
} from '@baci/shared/contracts';

function projectProps(componentType: string, operation: string) {
  const props =
    builderDesignCapabilityAdapter.getCapability(componentType)
      ?.specialOperations?.[operation] ?? {};
  return Object.fromEntries(
    Object.entries(props).map(([property, descriptor]) => [
      property,
      descriptor.maximumLength
        ? { maximumLength: descriptor.maximumLength }
        : {},
    ])
  );
}

export function getBuilderAiSpecialOperationGuidance() {
  return {
    updateCarouselSlide: {
      ...projectProps('HeroCarousel', 'updateCarouselSlide'),
      mediaMutation: {
        message: builderDesignCapabilities.refusalCodes['media-review'],
        refusalCode: 'media-review',
      },
    },
    updateRoot: { title: { maximumLength: 120 } },
  };
}
