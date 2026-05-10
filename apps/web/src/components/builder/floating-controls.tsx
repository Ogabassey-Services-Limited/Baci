'use client';

import type { ComponentData } from '@puckeditor/core';
import { usePuck } from '@puckeditor/core';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

// Types for Puck field configuration (not exported by Puck)
interface FieldOption {
  label: string;
  value: string;
}

interface PuckFieldConfig {
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'custom';
  label?: string;
  options?: FieldOption[];
  render?: (props: {
    field: PuckFieldConfig;
    name: string;
    value: unknown;
    onChange: (value: unknown) => void;
    readOnly: boolean;
  }) => React.ReactNode;
}

// Internal state type for Puck as it does not export PrivateAppState
interface PuckInternalState {
  ui: {
    selectedItem: ComponentData | null;
    itemSelector: { index: number; zone?: string } | null;
    // The actual state has selectedItem but it's not exported in AppState
    // We type it here safely
  };
  config: {
    components: Record<
      string,
      { label?: string; fields?: Record<string, PuckFieldConfig> }
    >;
  };
  data: {
    content: ComponentData[];
    root: Record<string, unknown>;
    zones?: Record<string, ComponentData[]>;
  };
}

export function FloatingControls() {
  const { appState, dispatch } = usePuck();
  // AppState doesn't expose `ui` or `config` directly, but the internal state does.
  // Type guard to safely narrow the external state. Verifies every top-level
  // property the cast to PuckInternalState promises so downstream accesses
  // (state.data.content spread, state.config.components lookup) cannot throw.
  function isPuckInternalState(state: unknown): state is PuckInternalState {
    if (typeof state !== 'object' || state === null) return false;
    if (!('ui' in state) || !('data' in state) || !('config' in state)) {
      return false;
    }
    // Verify data.content is an array, since safeFieldChange spreads it.
    const data = (state as { data?: unknown }).data;
    if (typeof data !== 'object' || data === null) return false;
    if (
      !('content' in data) ||
      !Array.isArray((data as { content?: unknown }).content)
    ) {
      return false;
    }
    return true;
  }

  if (!isPuckInternalState(appState)) return null;
  const state = appState;

  const { selectedItem } = state.ui;
  const { config } = state;

  if (!selectedItem?.props) return null;

  // Safety check: Ensure config and components exist
  if (!config?.components) return null;

  const componentConfig = config.components[selectedItem.type];

  // Safety check: Ensure componentConfig exists
  if (!componentConfig) return null;

  const fields = componentConfig?.fields;

  if (!fields) return null;

  // We'll use the setData approach as it's universally safe in Puck
  const safeFieldChange = (fieldName: string, value: unknown) => {
    const newContent = [...state.data.content];
    // Note: selectedItem.props.id might not be the item ID.
    // Puck items have an 'id' property at the root, not just in props.
    // selectedItem is the item itself.
    const itemIndex = newContent.findIndex(
      (item: ComponentData) => item.props.id === selectedItem.props.id
    );

    if (itemIndex !== -1) {
      newContent[itemIndex] = {
        ...newContent[itemIndex],
        props: {
          ...newContent[itemIndex].props,
          [fieldName]: value,
        },
      };

      dispatch({
        type: 'setData',
        data: { ...state.data, content: newContent },
      });
    }
  };

  return (
    <div className="fixed right-6 top-24 z-[60] w-80 bg-background/95 backdrop-blur-md border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-8rem)] animate-in slide-in-from-right-5 duration-200">
      <div className="flex items-center justify-between p-4 border-b bg-muted/30">
        <h3 className="font-semibold text-sm">
          Edit {componentConfig.label || selectedItem.type}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() =>
            dispatch({ type: 'setUi', ui: { itemSelector: null } })
          }
          aria-label="Close controls"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar">
        {Object.entries(fields as Record<string, PuckFieldConfig>).map(
          ([fieldName, fieldConfig]) => {
            const value = selectedItem.props[fieldName];
            const label = fieldConfig.label || fieldName;

            // Skip if it's a custom field we don't support yet, unless it's ImagePicker
            // Actually we support most basic types.

            return (
              <div key={fieldName} className="space-y-2">
                {fieldConfig.type !== 'custom' && <Label>{label}</Label>}

                {fieldConfig.type === 'text' && (
                  <Input
                    value={value || ''}
                    onChange={(e) => safeFieldChange(fieldName, e.target.value)}
                  />
                )}

                {fieldConfig.type === 'textarea' && (
                  <Textarea
                    value={value || ''}
                    onChange={(e) => safeFieldChange(fieldName, e.target.value)}
                    className="min-h-[80px]"
                  />
                )}

                {fieldConfig.type === 'number' && (
                  <Input
                    type="number"
                    value={value || ''}
                    onChange={(e) =>
                      safeFieldChange(fieldName, Number(e.target.value))
                    }
                  />
                )}

                {fieldConfig.type === 'select' && fieldConfig.options && (
                  <Select
                    value={value || ''}
                    onValueChange={(v) => safeFieldChange(fieldName, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fieldConfig.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {fieldConfig.type === 'radio' && fieldConfig.options && (
                  <RadioGroup
                    value={value || ''}
                    onValueChange={(v) => safeFieldChange(fieldName, v)}
                    className="flex flex-col gap-2"
                  >
                    {fieldConfig.options.map((opt) => (
                      <div
                        key={opt.value}
                        className="flex items-center space-x-2"
                      >
                        <RadioGroupItem
                          value={opt.value}
                          id={`${fieldName}-${opt.value}`}
                        />
                        <Label htmlFor={`${fieldName}-${opt.value}`}>
                          {opt.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {fieldConfig.type === 'custom' && fieldConfig.render && (
                  // If it's the ImagePickerField, we can try to render it if we can identify it
                  // Or we can just check the field name or properties.
                  // In config.tsx, ImagePickerField is used with type: 'custom' and a render function.
                  // We can't easily serialize the render function to check equality.
                  // But we can check if the field name implies an image, or if we imported ImagePickerField.
                  // Actually, we can just use our ImagePickerField component if the field looks like an image field.
                  // Or better, we can check if the config uses ImagePickerField.
                  // For now, let's assume if it's 'custom' and has 'image' in the name, or if we can just render the custom component?
                  // Puck's custom render function expects { field, name, value, onChange }.
                  // We can try to invoke it!
                  // fieldConfig.render({ field: fieldConfig, name: fieldName, value, onChange: (v) => safeFieldChange(fieldName, v) })
                  // This is the best way!
                  <div className="custom-field-wrapper">
                    {fieldConfig.render({
                      field: fieldConfig,
                      name: fieldName,
                      value,
                      onChange: (v: unknown) => safeFieldChange(fieldName, v),
                      // Puck might pass more props like 'readOnly', etc.
                      readOnly: false,
                    })}
                  </div>
                )}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
