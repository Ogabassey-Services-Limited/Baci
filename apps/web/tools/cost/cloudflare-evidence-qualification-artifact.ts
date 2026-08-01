import { z } from 'zod';
import { calculateCanonicalSha256 } from '../../../../packages/shared/src/storefront/delivery-evidence';

const Hash = z.string().regex(/^[a-f0-9]{64}$/);

/**
 * Provider module bytes are normalized to base64 before they cross the
 * readback boundary. This is the same wire representation used by the
 * qualification worker receipt, so hashes can be compared independently.
 */
export const QualificationArtifactModuleSchema = z
  .object({
    name: z.string().min(1),
    bytesBase64: z
      .string()
      .regex(
        /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
      ),
  })
  .strict();

export const QualificationArtifactModuleListSchema = z
  .array(QualificationArtifactModuleSchema)
  .min(1)
  .superRefine((modules, context) => {
    const names = new Set<string>();
    for (const [index, module] of modules.entries()) {
      if (names.has(module.name))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'name'],
          message: 'module names must be unique',
        });
      names.add(module.name);
    }
  });

export type QualificationArtifactModule = z.infer<
  typeof QualificationArtifactModuleSchema
>;

/** Canonicalizes names and exact provider-returned module bytes. */
export function canonicalizeQualificationArtifactModules(
  modules: readonly QualificationArtifactModule[]
) {
  const parsed = QualificationArtifactModuleListSchema.parse(modules);
  return JSON.stringify(
    [...parsed]
      .sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      )
      .map(({ name, bytesBase64 }) => ({ name, bytesBase64 }))
  );
}

export function calculateQualificationArtifactModuleListSha256(
  modules: readonly QualificationArtifactModule[]
) {
  return calculateCanonicalSha256(
    canonicalizeQualificationArtifactModules(modules)
  );
}

export const QualificationArtifactReadbackVersionSchema = z
  .object({
    versionId: z.string().min(1),
    endpoint: z.string().min(1),
    scriptEtag: Hash,
    moduleSha256: Hash,
    modules: QualificationArtifactModuleListSchema,
    moduleListSha256: Hash,
    settingsSha256: Hash,
  })
  .strict()
  .refine(
    ({ moduleListSha256, modules }) =>
      moduleListSha256 ===
      calculateQualificationArtifactModuleListSha256(modules),
    'provider module-list hash must bind the returned module bytes'
  );
