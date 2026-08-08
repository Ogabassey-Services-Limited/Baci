import {
  type AiEditableComponentType,
  aiEditableComponents,
} from './builder-ai-component-definitions';
import {
  builderAiEnumProps,
  builderAiNumberRanges,
  getBuilderAiPropShape,
} from './builder-ai-component-prop-validation';
import { builderAiStructuredPropProjectionDetails } from './builder-ai-structured-prop-projection-details';
import { getAiComponentDefinition } from './get-ai-component-definition';

export function getBuilderAiCatalogProjection() {
  return Object.keys(aiEditableComponents).map((componentType) => {
    const definition = getAiComponentDefinition(
      componentType as AiEditableComponentType
    );
    return {
      componentType,
      editableProps: definition.editableProps.map((property) => {
        const key = `${componentType}.${property}`;
        const allowedValues = builderAiEnumProps[key];
        const range = builderAiNumberRanges[key];
        return {
          name: property,
          shape: getBuilderAiPropShape(componentType, property),
          ...(builderAiStructuredPropProjectionDetails[key] ?? {}),
          ...(allowedValues ? { allowedValues } : {}),
          ...(range
            ? {
                maximum: range[1],
                minimum: range[0],
                wholeNumber: range[2] === true,
              }
            : {}),
        };
      }),
      insertable: definition.insertable === true,
      protected: definition.protected === true,
    };
  });
}
