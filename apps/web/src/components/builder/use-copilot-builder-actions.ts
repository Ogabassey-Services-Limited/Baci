'use client';

import { builderDesignCapabilities } from '@baci/shared/contracts';
import { useCopilotAction, useCopilotReadable } from '@copilotkit/react-core';
import type { Data } from '@puckeditor/core';
import { sanitizeBuilderAiProps } from '@/lib/builder-ai/sanitize-builder-ai-props';
import { COMPONENT_SCHEMA } from './component-schema';

interface UseCopilotBuilderActionsProps {
  data: Data;
  setData: (data: Data) => void;
}

function findCapability(componentType: string) {
  return builderDesignCapabilities.components.find(
    (capability) => capability.componentType === componentType
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProps(value: string | undefined): Record<string, unknown> | null {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function createUniqueComponentId(
  componentType: string,
  content: Data['content']
) {
  const base = `${componentType}-${Date.now()}`;
  const ids = new Set(
    content.flatMap((component) =>
      typeof component.props.id === 'string' ? [component.props.id] : []
    )
  );
  let id = base;
  let suffix = 1;
  while (ids.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * Hook to register CopilotKit actions for the builder.
 * Allows AI to add, remove, and modify components with specific props.
 */
export function useCopilotBuilderActions({
  data,
  setData,
}: UseCopilotBuilderActionsProps) {
  // Make current config and available tools readable by AI
  useCopilotReadable({
    description:
      'The current storefront page configuration. You can modify this using actions.',
    value: JSON.stringify({
      availableComponents: COMPONENT_SCHEMA,
      currentComponents: data.content?.map((c, index) => ({
        index,
        type: c.type,
        id: c.props.id,
        // Expose a summary of props so AI knows what's already there
        summary:
          c.type === 'Hero'
            ? c.props.title
            : c.type === 'ProductGrid'
              ? c.props.title
              : undefined,
      })),
    }),
  });

  // Action: Add a component with specific props
  useCopilotAction({
    name: 'addComponent',
    description: `Add a new component to the page. Available types: ${Object.keys(COMPONENT_SCHEMA).join(', ')}.`,
    parameters: [
      {
        name: 'componentType',
        type: 'string',
        description: 'The type of component to add.',
        required: true,
      },
      {
        name: 'position',
        type: 'number',
        description: 'Index to insert at (0 = top). Default is bottom (-1).',
        required: false,
      },
      {
        name: 'props',
        type: 'string', // Copilot handles complex objects better as JSON strings sometimes, but we'll try object first in next iteration if needed.
        description:
          'JSON string of props to initialize the component with (e.g., title, subtitle). Refer to availableComponents schema.',
        required: false,
      },
    ],
    handler: ({ componentType, position = -1, props }) => {
      const capability = findCapability(componentType);
      if (!capability) return `Invalid component type: ${componentType}.`;
      if (!capability.aiInsertable) {
        return `Component type is not insertable: ${componentType}.`;
      }

      const parsedProps = parseProps(props);
      if (!parsedProps) return 'Failed to parse props JSON.';
      const sanitized = sanitizeBuilderAiProps(componentType, parsedProps);
      const newContent = [...(data.content || [])];

      const newComponent = {
        type: componentType,
        props: {
          id: createUniqueComponentId(componentType, newContent),
          ...sanitized.props,
        },
      };

      if (position === -1 || position >= newContent.length) {
        newContent.push(newComponent);
      } else {
        newContent.splice(Math.max(0, position), 0, newComponent);
      }

      setData({ ...data, content: newContent });
      return `Added ${componentType} at position ${position === -1 ? 'bottom' : position}.`;
    },
  });

  // Action: Update an existing component
  useCopilotAction({
    name: 'updateComponent',
    description:
      'Update the properties of an existing component. Use this to change text, images, or layout.',
    parameters: [
      {
        name: 'index',
        type: 'number',
        description: 'The index of the component to update (0-based).',
        required: true,
      },
      {
        name: 'updates',
        type: 'string',
        description:
          'JSON string of properties to update (e.g., {"title": "New Title"}).',
        required: true,
      },
    ],
    handler: ({ index, updates }) => {
      const newContent = [...(data.content || [])];

      if (index < 0 || index >= newContent.length) {
        return `Invalid index: ${index}. Component not found.`;
      }
      if (!findCapability(newContent[index].type)?.aiEditable) {
        return `Component type is not editable: ${newContent[index].type}.`;
      }

      const parsedUpdates = parseProps(updates);
      if (!parsedUpdates) return 'Failed to parse updates JSON.';
      const sanitized = sanitizeBuilderAiProps(
        newContent[index].type,
        parsedUpdates
      );

      newContent[index] = {
        ...newContent[index],
        props: {
          ...newContent[index].props,
          ...sanitized.props,
        },
      };

      setData({ ...data, content: newContent });
      return `Updated component at index ${index}.`;
    },
  });

  // Action: Remove a component
  useCopilotAction({
    name: 'removeComponent',
    description: 'Remove a component from the page.',
    parameters: [
      {
        name: 'index',
        type: 'number',
        description: 'The index of the component to remove.',
        required: true,
      },
    ],
    handler: ({ index }) => {
      const newContent = [...(data.content || [])];
      if (index >= 0 && index < newContent.length) {
        const target = newContent[index];
        const capability = findCapability(target.type);
        if (!capability?.aiEditable || capability.protected) {
          return `Component type is not removable: ${target.type}.`;
        }
        const removed = newContent.splice(index, 1)[0];
        setData({ ...data, content: newContent });
        return `Removed ${removed.type} at index ${index}.`;
      }
      return `Invalid index: ${index}`;
    },
  });
}
