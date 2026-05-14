import { z } from 'zod';

export const incrementViewCountPostIdSchema = z.string().trim().min(1);
