import { join, relative } from 'node:path';
import {
  TS_EXTENSIONS,
  TS_ROOTS,
} from './product-description-writer-inventory';
import { listFiles, readFilesWithConcurrency } from './product-description-writer-file-reading';
import { sqlWritesProductDescription } from './product-description-writer-sql-matcher';

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
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+((?:public|private)\.[\w]+)\s*\(/gi;
  for (const match of source.matchAll(startPattern)) {
    const start = match.index ?? 0;
    const openingParenthesis = start + match[0].length - 1;
    const closingParenthesis = findClosingParenthesis(
      source,
      openingParenthesis
    );
    if (closingParenthesis < 0) {
      continue;
    }
    const header = /[\s\S]*?\bAS\s+(\$[\w]*\$)/i.exec(
      source.slice(closingParenthesis + 1)
    );
    if (!header) {
      continue;
    }
    const tag = header[1];
    const bodyStart =
      closingParenthesis + 1 + header.index + header[0].length;
    const bodyEnd = source.indexOf(tag, bodyStart);
    if (bodyEnd >= 0) {
      const normalizedArguments = source
        .slice(openingParenthesis + 1, closingParenthesis)
        .replace(/\s+/g, ' ')
        .trim();
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

const SQL_TYPE_START_REGEX =
  /^(?:bigint|bigserial|bit(?:\s+varying)?|bool(?:ean)?|bytea|char(?:acter)?(?:\s+varying)?|date|decimal|double\s+precision|float(?:4|8)?|inet|int(?:2|4|8)?|integer|jsonb?|money|numeric|real|record|serial(?:2|4|8)?|smallint|text|time(?:\s+(?:with|without)\s+time\s+zone)?|timestamp(?:\s+(?:with|without)\s+time\s+zone)?|uuid|varbit|void|xml)(?:\s|\(|\[|$)/i;

function splitFunctionArguments(source: string): string[] {
  const argumentsList: string[] = [];
  let start = 0;
  let depth = 0;
  let quote: '"' | "'" | undefined;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (char === quote) {
        if (next === quote) {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      argumentsList.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }

  const lastArgument = source.slice(start).trim();
  if (lastArgument) argumentsList.push(lastArgument);
  return argumentsList;
}

function stripArgumentDefault(source: string): string {
  let depth = 0;
  let quote: '"' | "'" | undefined;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (char === quote) {
        if (next === quote) {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (depth === 0 && char === '=') {
      return source.slice(0, index).trim();
    } else if (
      depth === 0 &&
      /[A-Za-z]/.test(char) &&
      /\bDEFAULT\b/i.test(source.slice(index)) &&
      /^(?:DEFAULT)\b/i.test(source.slice(index))
    ) {
      return source.slice(0, index).trim();
    }
  }
  return source.trim();
}

function canonicalInputArgumentType(source: string): string | null {
  let argument = stripArgumentDefault(source).replace(/^\s*(INOUT|IN|OUT|VARIADIC)\s+/i, '');
  if (/^OUT\b/i.test(source.trim())) return null;
  if (!SQL_TYPE_START_REGEX.test(argument)) {
    const namedArgument = /^(?:"(?:[^"]|"")+"|[A-Za-z_][\w$]*)\s+([\s\S]+)$/.exec(
      argument
    );
    if (namedArgument) argument = namedArgument[1].trim();
  }
  return argument.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function canonicalFunctionIdentity(signature: string): string {
  const openingParenthesis = signature.indexOf('(');
  const name =
    openingParenthesis >= 0
      ? signature.slice(0, openingParenthesis).trim().toLowerCase()
      : signature.trim().toLowerCase();
  const argumentsSource =
    openingParenthesis >= 0
      ? signature.slice(openingParenthesis + 1, signature.lastIndexOf(')'))
      : '';
  const inputTypes = splitFunctionArguments(argumentsSource)
    .map(canonicalInputArgumentType)
    .filter((argument): argument is string => Boolean(argument));
  return `${name}(${inputTypes.join(',')})`;
}

function findClosingParenthesis(source: string, openingParenthesis: number) {
  let depth = 0;
  let quote: '"' | "'" | undefined;

  for (let index = openingParenthesis; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (quote) {
      if (char === quote) {
        if (next === quote) {
          index += 1;
        } else {
          quote = undefined;
        }
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

export async function discoverSql(root: string): Promise<string[]> {
  const files = (
    await listFiles(join(root, 'supabase/migrations'))
  )
    .filter(
      (path) => path.endsWith('.sql') && !path.includes('/migrations/tests/')
    )
    .sort();
  const sources = await readFilesWithConcurrency(files);
  const latest = new Map<string, { path: string; body: string }>();
  const discovered = new Set<string>();
  for (const [index, path] of files.entries()) {
    const source = sources[index];
    const definitions = functionDefinitions(source);
    let topLevel = source;
    for (const definition of definitions) {
      latest.set(canonicalFunctionIdentity(definition.signature), {
        path,
        body: definition.body,
      });
      topLevel = `${topLevel.slice(0, definition.start)}${' '.repeat(
        definition.end - definition.start
      )}${topLevel.slice(definition.end)}`;
    }
    if (sqlWritesProductDescription(topLevel)) discovered.add(relative(root, path));
  }
  for (const { path, body } of latest.values()) {
    if (sqlWritesProductDescription(body)) discovered.add(relative(root, path));
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
