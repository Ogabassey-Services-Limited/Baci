import path from 'node:path';
import { z } from 'zod';

const migrationVersion = z.string().regex(/^\d{14}$/);
const migrationName = z.string().regex(/^[a-z0-9_]+$/);
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const migrationPath = z
  .string()
  .regex(/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/);

const rowSchema = z
  .object({
    version: migrationVersion,
    name: migrationName,
    localPaths: z.array(migrationPath),
    localSha256: z.array(sha256),
  })
  .strict()
  .refine((row) => row.localPaths.length === row.localSha256.length, {
    message: 'localPaths and localSha256 cardinality must match',
  });

export const linkedMigrationLedgerSchema = z
  .object({
    schemaVersion: z.literal(1),
    baseSha: z.literal('9e3d1b14b1931a5e441fc23f0e5417c188056e47'),
    linkedRowCount: z.literal(442),
    linkedTailVersion: z.literal('20260714225503'),
    localFileCount: z.literal(424),
    localUniqueVersionCount: z.literal(422),
    rows: z.array(rowSchema).length(442),
  })
  .strict()
  .superRefine((fixture, context) => {
    const linkedVersions = new Set<string>();
    const localPaths = new Set<string>();
    const localVersions = new Set<string>();
    fixture.rows.forEach((row, index) => {
      if (linkedVersions.has(row.version)) {
        context.addIssue({
          code: 'custom',
          message: 'linked migration version must be unique',
          path: ['rows', index, 'version'],
        });
      }
      linkedVersions.add(row.version);
      if (index > 0 && fixture.rows[index - 1].version >= row.version) {
        context.addIssue({
          code: 'custom',
          message: 'linked migration rows must be version ordered',
          path: ['rows', index, 'version'],
        });
      }
      row.localPaths.forEach((repositoryPath, pathIndex) => {
        if (localPaths.has(repositoryPath)) {
          context.addIssue({
            code: 'custom',
            message: 'local migration path must be unique',
            path: ['rows', index, 'localPaths', pathIndex],
          });
        }
        localPaths.add(repositoryPath);
        const localVersion = path.posix.basename(repositoryPath).slice(0, 14);
        if (localVersion !== row.version) {
          context.addIssue({
            code: 'custom',
            message: 'local migration version must match linked row',
            path: ['rows', index, 'localPaths', pathIndex],
          });
        }
        localVersions.add(localVersion);
      });
    });
    if (fixture.rows.at(-1)?.version !== fixture.linkedTailVersion) {
      context.addIssue({
        code: 'custom',
        message: 'linked tail version drift',
        path: ['rows'],
      });
    }
    if (
      localPaths.size !== fixture.localFileCount ||
      localVersions.size !== fixture.localUniqueVersionCount
    ) {
      context.addIssue({
        code: 'custom',
        message: 'local migration registry count drift',
        path: ['rows'],
      });
    }
  });

export type LinkedMigrationLedger = z.infer<typeof linkedMigrationLedgerSchema>;
