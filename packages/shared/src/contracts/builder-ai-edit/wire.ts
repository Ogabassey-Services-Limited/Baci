import { z } from 'zod';
import {
  BUILDER_AI_EDIT_CONTRACT_VERSION,
  MAX_AI_EDIT_BODY_BYTES,
  MAX_BUILDER_BLOCKS,
} from './limits';

export const builderComponentDataSchema = z.looseObject({
  props: z.record(z.string(), z.unknown()),
  type: z.string().trim().min(1).max(80),
});

export const builderDataSchema = z.looseObject({
  content: z.array(builderComponentDataSchema).max(MAX_BUILDER_BLOCKS),
  root: z.record(z.string(), z.unknown()),
  theme: z.record(z.string(), z.unknown()).optional(),
  zones: z.record(z.string(), z.unknown()).optional(),
});

export const builderAiEditRequestSchema = z.strictObject({
  clientRequestId: z.uuid(),
  contractVersion: z.literal(BUILDER_AI_EDIT_CONTRACT_VERSION),
  currentConfig: builderDataSchema,
  merchantId: z.uuid(),
  prompt: z.string().trim().min(1).max(1000),
});

export type BuilderAiEditRequest = z.infer<typeof builderAiEditRequestSchema>;
export type BuilderData = z.infer<typeof builderDataSchema>;
export { MAX_AI_EDIT_BODY_BYTES };
