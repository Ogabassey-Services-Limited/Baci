import { readFileSync } from 'node:fs';

const sql = readFileSync(process.argv[2], 'utf8');
const statements = [];
let start = 0;
let index = 0;
let singleQuote = false;
let escapeStringQuote = false;
let doubleQuote = false;
let lineComment = false;
let blockCommentDepth = 0;
let dollarQuoteTag = null;

const isDollarTagCharacter = (character) => /[A-Za-z0-9_]/.test(character);
const isIdentifierCharacter = (character) => /[A-Za-z0-9_$]/.test(character);
const readDollarQuoteTag = (dollarIndex) => {
  const previous = sql[dollarIndex - 1];
  if (previous && isIdentifierCharacter(previous)) {
    return null;
  }
  if (sql[dollarIndex + 1] === '$') {
    return '$$';
  }
  if (!/[A-Za-z_]/.test(sql[dollarIndex + 1] ?? '')) {
    return null;
  }
  let end = dollarIndex + 2;
  while (end < sql.length && isDollarTagCharacter(sql[end])) {
    end += 1;
  }
  return sql[end] === '$' ? sql.slice(dollarIndex, end + 1) : null;
};
const isEscapeStringPrefix = (quoteIndex) => {
  const previous = sql[quoteIndex - 1];
  if (previous !== 'E' && previous !== 'e') {
    return false;
  }
  const beforePrevious = sql[quoteIndex - 2];
  return !beforePrevious || !isIdentifierCharacter(beforePrevious);
};

while (index < sql.length) {
  const character = sql[index];
  const next = sql[index + 1];

  if (lineComment) {
    lineComment = character !== '\n';
    index += 1;
    continue;
  }
  if (blockCommentDepth > 0) {
    if (character === '/' && next === '*') {
      blockCommentDepth += 1;
      index += 2;
      continue;
    }
    if (character === '*' && next === '/') {
      blockCommentDepth -= 1;
      index += 2;
      continue;
    }
    index += 1;
    continue;
  }
  if (dollarQuoteTag) {
    if (sql.startsWith(dollarQuoteTag, index)) {
      index += dollarQuoteTag.length;
      dollarQuoteTag = null;
    } else {
      index += 1;
    }
    continue;
  }
  if (singleQuote) {
    if (escapeStringQuote && character === '\\') {
      index += 2;
      continue;
    }
    if (character === "'" && next === "'") {
      index += 2;
      continue;
    }
    if (character === "'") {
      singleQuote = false;
      escapeStringQuote = false;
    }
    index += 1;
    continue;
  }
  if (doubleQuote) {
    if (character === '"' && next === '"') {
      index += 2;
      continue;
    }
    if (character === '"') {
      doubleQuote = false;
    }
    index += 1;
    continue;
  }
  if (character === '-' && next === '-') {
    lineComment = true;
    index += 2;
    continue;
  }
  if (character === '/' && next === '*') {
    blockCommentDepth = 1;
    index += 2;
    continue;
  }
  if (character === "'") {
    singleQuote = true;
    escapeStringQuote = isEscapeStringPrefix(index);
    index += 1;
    continue;
  }
  if (character === '"') {
    doubleQuote = true;
    index += 1;
    continue;
  }
  if (character === '$') {
    const tag = readDollarQuoteTag(index);
    if (tag) {
      dollarQuoteTag = tag;
      index += tag.length;
      continue;
    }
  }
  if (character === ';') {
    const statement = sql.slice(start, index + 1).trim();
    if (statement.replace(/--.*$/gm, '').trim()) {
      statements.push(statement);
    }
    start = index + 1;
  }
  index += 1;
}

const trailing = sql.slice(start).trim();
if (trailing.replace(/--.*$/gm, '').trim()) {
  statements.push(trailing);
}

for (const statement of statements) {
  console.log(JSON.stringify(statement));
}
