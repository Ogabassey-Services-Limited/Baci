import { readFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_MANAGEMENT_BYTES = 8 * 1024 * 1024;
const MANAGEMENT_TIMEOUT_MS = 30_000;

class OversizedManagementResponse extends Error {}

async function readLimitedResponse(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_MANAGEMENT_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new OversizedManagementResponse();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, totalBytes);
}

async function linkedProjectRef(workspaceRoot: string): Promise<string> {
  const value =
    process.env.SUPABASE_PROJECT_REF ??
    (await readFile(
      path.join(workspaceRoot, 'supabase/.temp/project-ref'),
      'utf8'
    ));
  const projectRef = value.trim();
  if (!/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error('Linked Supabase project reference is unavailable');
  }
  return projectRef;
}

export async function createSupabaseManagementReadOnlyExecutor(
  workspaceRoot: string
): Promise<(query: string) => Promise<unknown[]>> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
  const projectRef = await linkedProjectRef(workspaceRoot);

  return async (query: string): Promise<unknown[]> => {
    let response: Response;
    try {
      response = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/database/query/read-only`,
        {
          body: JSON.stringify({ query }),
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: AbortSignal.timeout(MANAGEMENT_TIMEOUT_MS),
        }
      );
    } catch {
      throw new Error('Supabase management query transport failed');
    }
    if (!response.ok) {
      throw new Error('Supabase management query failed');
    }
    let bytes: Buffer;
    try {
      bytes = await readLimitedResponse(response);
    } catch (error) {
      if (error instanceof OversizedManagementResponse) {
        throw new Error('Supabase management query failed');
      }
      throw new Error('Supabase management query transport failed');
    }
    try {
      const parsed: unknown = JSON.parse(bytes.toString('utf8'));
      if (!Array.isArray(parsed)) throw new Error('invalid');
      return parsed;
    } catch {
      throw new Error('Supabase management query response was invalid');
    }
  };
}
