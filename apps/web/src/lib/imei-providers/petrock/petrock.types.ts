import type { z } from 'zod';
import type { petrockOrderStatusSchema } from './petrock.schemas';

export type PetrockOrderStatus = z.infer<typeof petrockOrderStatusSchema>;

export interface PetrockOrderSubmission {
  feedbackUrl: string;
  identifier: string;
  orderFieldName: string;
  productId: string;
  referenceId: string;
}

export type PetrockClientFailure = {
  kind: 'http' | 'invalid_response' | 'network' | 'timeout';
  message: string;
  ok: false;
  status?: number;
};

export type PetrockClientResult<T> =
  | { data: T; ok: true; rawText: string }
  | PetrockClientFailure;
