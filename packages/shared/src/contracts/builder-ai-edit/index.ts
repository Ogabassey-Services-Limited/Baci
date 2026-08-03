import { builderAiEditCandidateSchema } from './candidate';
import { BUILDER_AI_EDIT_CONTRACT_VERSION } from './limits';
import { builderAiModelPlanSchema } from './model-plan';
import { builderAiEditRequestSchema, builderDataSchema } from './wire';

export const builderAiEditContract = {
  builderDataSchema,
  candidateSchema: builderAiEditCandidateSchema,
  modelPlanSchema: builderAiModelPlanSchema,
  requestSchema: builderAiEditRequestSchema,
  version: BUILDER_AI_EDIT_CONTRACT_VERSION,
} as const;

export * from './candidate';
export * from './catalog';
export * from './complexity-validator';
export * from './feature-icons';
export * from './limits';
export * from './model-plan';
export * from './operation-description';
export * from './wire';
