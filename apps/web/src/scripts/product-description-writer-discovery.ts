import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  TS_EXTENSIONS,
  TS_ROOTS,
} from './product-description-writer-inventory';
import { listFiles, readFilesWithConcurrency } from './product-description-writer-file-reading';

type FunctionDefinition = {
  body: string;
  end: number;
  signature: string;
  start: number;
};

function writesDescription(source: string): boolean {
  return /\bdescription\b/.test(source);
}

function directProductsMutation(source: string): boolean {
  return (
    /\.from\(\s*['"]products['"]\s*\)(?:(?![;{}])[\s\S])*?\.(?:insert|update|upsert)\s*\(/.test(
      source
    ) && writesDescription(source)
  );
}

function persistenceCaller(path: string, source: string): boolean {
  const productRpc = /\.rpc\(\s*['"](?=[^'"]*(?:product|catalog))(?=[^'"]*(?:save|create|update|upsert|persist|write))[^'"]+['"]\s*,[\s\S]*?\b(?:description|product_description)\b/i.test(
    source
  );
  const generatedCopy =
    /await\s+\w*(?:generate|autofill|compose|draft|create)\w*(?:description|details|copy)\w*\s*\(/i.test(
      source
    );
  const productSubmit =
    /(?:submit|create|update|save|on)\w*(?:product|catalog|listing|item)\w*\s*\([\s\S]*?\bdescription\b/i.test(
      source
    );
  return (
    (productRpc || (generatedCopy && productSubmit)) &&
    writesDescription(source) &&
    !path.includes('.test.') &&
    !path.endsWith('check-product-description-writers.ts')
  );
}

function aiProducer(path: string, source: string): boolean {
  return (
    path.includes('/ai/flows/') &&
    /product/i.test(path) &&
    /generate(?:Text|Object)WithChain/.test(source) &&
    writesDescription(source)
  );
}

export function functionDefinitions(source: string): FunctionDefinition[] {
  const definitions: FunctionDefinition[] = [];
  const startPattern =
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public|private)\.[\w]+)\s*\(([^)]*)\)[\s\S]*?\bAS\s+(\$[\w]*\$)/gi;
  for (const match of source.matchAll(startPattern)) {
    const start = match.index ?? 0;
    const tag = match[3];
    const bodyStart = start + match[0].length;
    const bodyEnd = source.indexOf(tag, bodyStart);
    if (bodyEnd >= 0) {
      const normalizedArguments = match[2].replace(/\s+/g, ' ').trim();
      definitions.push({
        signature: `${match[1]}(${normalizedArguments})`,
        start,
        end: bodyEnd + tag.length,
        body: source.slice(bodyStart, bodyEnd),
      });
    }
  }
  return definitions;
}

function sqlWritesDescription(source: string): boolean {
  return /INSERT\s+INTO\s+public\.products\s*\([\s\S]*?\bdescription\b[\s\S]*?\)\s*VALUES|UPDATE\s+public\.products\b[\s\S]*?\bSET\b[\s\S]*?\bdescription\s*=/i.test(
    source
  );
}

export async function discoverSql(root: string): Promise<string[]> {
  const files = (
    await listFiles(join(root, 'supabase/migrations'))
  )
    .filter(
      (path) => path.endsWith('.sql') && !path.includes('/migrations/tests/')
    )
    .sort();
  const latest = new Map<string, { path: string; body: string }>();
  const discovered = new Set<string>();
  for (const path of files) {
    const source = await readFile(path, 'utf8');
    const definitions = functionDefinitions(source);
    let topLevel = source;
    for (const definition of definitions) {
      latest.set(definition.signature, {
        path,
        body: definition.body,
      });
      topLevel = `${topLevel.slice(0, definition.start)}${' '.repeat(
        definition.end - definition.start
      )}${topLevel.slice(definition.end)}`;
    }
    if (sqlWritesDescription(topLevel)) discovered.add(relative(root, path));
  }
  for (const { path, body } of latest.values()) {
    if (sqlWritesDescription(body)) discovered.add(relative(root, path));
  }
  return [...discovered];
}

export async function discoverWriterPaths(root: string): Promise<string[]> {
  const files = (
    await Promise.all(
      TS_ROOTS.map((path) => listFiles(join(root, path)))
    )
  )
    .flat()
    .filter(
      (path) =>
        TS_EXTENSIONS.has(path.slice(path.lastIndexOf('.'))) &&
        !path.includes('.test.')
    );
  const sources = await readFilesWithConcurrency(files);
  const paths = files.map((path, index) => {
    const source = sources[index];
    const rel = relative(root, path);
    return directProductsMutation(source) ||
      persistenceCaller(rel, source) ||
      aiProducer(rel, source)
      ? [rel]
      : [];
  });
  return [...new Set([...paths.flat(), ...(await discoverSql(root))])].sort();
}
