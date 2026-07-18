import { z } from 'zod';

export const eventPipelineReplayIdsSchema = z.array(z.uuid()).max(100);
