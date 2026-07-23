import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(
  dirname(fileURLToPath(import.meta.url)),
  'split-sql-statements.mjs'
);

test('splits top-level SQL without splitting quoted or commented semicolons', () => {
  const directory = mkdtempSync(join(tmpdir(), 'baci-sql-split-'));
  const fixture = join(directory, 'fixture.sql');
  writeFileSync(
    fixture,
    `-- comment ;
CREATE FUNCTION test_fn() RETURNS void AS $body$
BEGIN
  PERFORM 'inside;function';
END;
$body$ LANGUAGE plpgsql;
/* outer ; /* nested ; */ done */
INSERT INTO test_table(value) VALUES (E'escaped\\';value');
SELECT "semi;colon";
SELECT value$tag$ FROM test_table;
SELECT 42;
`
  );

  try {
    const output = execFileSync(process.execPath, [script, fixture], {
      encoding: 'utf8',
    });
    const statements = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    assert.equal(statements.length, 5);
    assert.match(statements[0], /CREATE FUNCTION test_fn/);
    assert.match(statements[1], /INSERT INTO test_table/);
    assert.match(statements[2], /SELECT "semi;colon"/);
    assert.match(statements[3], /SELECT value\$tag\$/);
    assert.match(statements[4], /SELECT 42/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
