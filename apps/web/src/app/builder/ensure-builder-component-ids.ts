import type { Data, DefaultComponentProps } from '@puckeditor/core';

export function ensureBuilderComponentIds(newData: Data): Data {
  if (!newData.content) {
    return newData;
  }

  return {
    ...newData,
    content: newData.content.map((component, index) => {
      const props = component.props as DefaultComponentProps;
      if (props?.id) {
        return component;
      }

      return {
        ...component,
        props: {
          ...props,
          id: `${component.type}-${Date.now()}-${index}`,
        },
      };
    }),
  };
}
