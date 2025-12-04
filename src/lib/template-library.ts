import type { ComponentType } from 'react';
import { GadgetCustomTemplateOgabassey } from '@/components/storefront/templates/gadget-custom-template-ogabassey';
import { GadgetDefaultTemplate } from '@/components/storefront/templates/gadget-default-template';

export interface TemplateDefinition {
  id: string;
  name: string;
  description?: string;
  component: ComponentType<Record<string, unknown>>;
  isCustom?: boolean;
}

export const TEMPLATE_LIBRARY: Record<string, TemplateDefinition> = {
  'gadget-default': {
    id: 'gadget-default',
    name: 'Gadget Default Template',
    component: GadgetDefaultTemplate,
    description: 'Standard template for all business types.',
    isCustom: false,
  },
  'gadget-custom-ogabassey': {
    id: 'gadget-custom-ogabassey',
    name: 'Gadget Custom Template Ogabassey',
    component: GadgetCustomTemplateOgabassey,
    description: 'Custom template with Bento Grid and specific branding.',
    isCustom: true,
  },
};

export function getTemplateById(id: string) {
  return TEMPLATE_LIBRARY[id];
}
