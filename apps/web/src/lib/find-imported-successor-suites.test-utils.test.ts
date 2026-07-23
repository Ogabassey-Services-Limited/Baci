import { describe, expect, it } from 'vitest';
import { findImportedSuccessorSuites } from './find-imported-successor-suites.test-utils';

const successors = [
  'static.test.ts',
  'dynamic.test.ts',
  'exported.test.ts',
  'required.test.ts',
  'import-equals.test.ts',
] as const;

describe('findImportedSuccessorSuites', () => {
  it('finds successor suites across supported module syntax', () => {
    const source = `
      import "./static.test";
      void import ( './dynamic.test.ts' );
      export * from "./exported.test";
      require ( './required.test' );
      import imported = require("./import-equals.test.ts");
    `;

    const result = findImportedSuccessorSuites(source, successors);

    expect(result).toEqual(successors);
  });

  it('ignores comments, ordinary strings, and unrelated modules', () => {
    const source = `
      // import './static.test';
      const example = './dynamic.test';
      import './ordinary-runtime-module';
    `;

    const result = findImportedSuccessorSuites(source, successors);

    expect(result).toEqual([]);
  });
});
