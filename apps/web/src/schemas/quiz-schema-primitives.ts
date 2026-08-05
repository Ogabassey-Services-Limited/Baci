import { QUIZ_MAX_TOPIC_LENGTH } from '@baci/shared/constants';
import { z } from 'zod';

export const quizUuidSchema = z.uuid();
export const quizIsoDatetimeSchema = z.iso.datetime({ offset: true });
export const quizIntegrityTierSchema = z.enum(['basic', 'device', 'strong']);
export const quizDifficultySchema = z.enum(['easy', 'standard', 'hard']);
export const quizNonEmptyIdSchema = z.string().min(1);
export const quizTopicSchema = z
  .string()
  .trim()
  .min(3)
  .max(QUIZ_MAX_TOPIC_LENGTH);
export const quizPrizeConditionSchema = z
  .enum(['new', 'used', 'open_box', 'refurbished'])
  .nullable();
