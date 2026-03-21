import { z } from 'zod';

const PageConfigBlockSchema = z.object({
  type: z.string().min(1),
  props: z
    .object({
      id: z.string().min(1),
    })
    .catchall(z.unknown()),
});

export const PageConfigSchema = z.object({
  content: z.array(PageConfigBlockSchema),
  // Theme payloads are merchant-defined and can vary by template/runtime.
  theme: z.unknown().optional(),
  root: z.object({
    props: z.object({
      title: z.string().min(1),
    }),
  }),
});

export type PageConfig = z.infer<typeof PageConfigSchema>;
