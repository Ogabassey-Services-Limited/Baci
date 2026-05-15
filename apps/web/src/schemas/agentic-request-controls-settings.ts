import { z } from 'zod';
import {
  AGENTIC_AGENT_ALLOWLIST_KEY,
  AGENTIC_AGENT_DENYLIST_KEY,
} from '@/lib/agentic/agent-request-controls.constants';

const agenticPatternListSchema = z.preprocess((value) => {
  if (typeof value === 'string') return value.split(',');
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string');
  }
  return [];
}, z.array(z.string()));

export const agenticRequestControlsSettingsSchema = z
  .object({
    [AGENTIC_AGENT_ALLOWLIST_KEY]: agenticPatternListSchema
      .optional()
      .default([]),
    [AGENTIC_AGENT_DENYLIST_KEY]: agenticPatternListSchema
      .optional()
      .default([]),
  })
  .passthrough();
