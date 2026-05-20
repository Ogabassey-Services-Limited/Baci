import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyNoReferenceImports } from '@/scripts/verify-quiz-source-references';

const tempRoots: string[] = [];

async function createTempRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'quiz-source-refs-'));
  tempRoots.push(root);
  return root;
}

async function writeSource(root: string, relativePath: string, contents: string) {
  const filePath = path.join(root, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}

describe('verifyNoReferenceImports', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { recursive: true }))
    );
  });

  it('passes when quiz source files use relative imports without forbidden patterns', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/app/quiz/index.tsx',
      "import Logo from '../../assets/quiz/svg/Logo.svg';\n"
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual([]);
  });

  it('reports forbidden references across supported source extensions', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/app/quiz/index.tsx',
      "import Logo from '/tmp/quiz-mobile/assets/svg/Logo.svg';\n"
    );
    await writeSource(
      root,
      'apps/mobile-storefront/components/quiz-card.jsx',
      "export const source = 'tmp/quiz-mobile/assets/png/Coins.png';\n"
    );
    await writeSource(
      root,
      'apps/mobile-storefront/services/quiz-windows.ts',
      "export const source = '\\\\tmp\\\\quiz-mobile\\\\assets\\\\Logo.svg';\n"
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'apps/mobile-storefront/app/quiz/index.tsx: /tmp/quiz-mobile'
        ),
        expect.stringContaining(
          'apps/mobile-storefront/components/quiz-card.jsx: tmp/quiz-mobile'
        ),
        expect.stringContaining(
          'apps/mobile-storefront/services/quiz-windows.ts: \\\\tmp\\\\quiz-mobile'
        ),
      ])
    );
  });

  it('reports every forbidden reference in one source file', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/services/quiz.ts',
      [
        "const logo = '/tmp/quiz-mobile/assets/svg/Logo.svg';",
        "const coins = 'tmp/quiz-mobile/assets/png/Coins.png';",
      ].join('\n')
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/tmp/quiz-mobile'),
        expect.stringContaining('tmp/quiz-mobile'),
      ])
    );
    expect(errors).toHaveLength(2);
  });

  it('detects supported TypeScript and JavaScript source extensions', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/hooks/useQuiz.ts',
      "export const ref = '/tmp/quiz-mobile/hooks/useQuiz.ts';\n"
    );
    await writeSource(
      root,
      'apps/mobile-storefront/lib/quiz.js',
      "export const ref = 'tmp/quiz-mobile/lib/quiz.js';\n"
    );
    await writeSource(
      root,
      'apps/mobile-storefront/stores/quiz.mjs',
      "export const ref = 'tmp/quiz-mobile/stores/quiz.mjs';\n"
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('apps/mobile-storefront/hooks/useQuiz.ts'),
        expect.stringContaining('apps/mobile-storefront/lib/quiz.js'),
        expect.stringContaining('apps/mobile-storefront/stores/quiz.mjs'),
      ])
    );
  });

  it('flags forbidden patterns in comments and string literals', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/app/quiz/comment.ts',
      [
        '// Do not keep /tmp/quiz-mobile reference comments in committed code.',
        "const ref = 'tmp/quiz-mobile/assets/svg/Logo.svg';",
      ].join('\n')
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/tmp/quiz-mobile'),
        expect.stringContaining('tmp/quiz-mobile'),
      ])
    );
  });

  it('does not report empty supported source files', async () => {
    const root = await createTempRepo();
    await writeSource(root, 'apps/mobile-storefront/app/quiz/empty.ts', '');
    await writeSource(root, 'apps/mobile-storefront/app/quiz/empty.js', '');
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual([]);
  });

  it('ignores missing source roots', async () => {
    const root = await createTempRepo();
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual([]);
  });

  it('skips node_modules and hidden directories', async () => {
    const root = await createTempRepo();
    await writeSource(
      root,
      'apps/mobile-storefront/app/node_modules/bad.ts',
      "export const bad = '/tmp/quiz-mobile/assets/svg/Logo.svg';\n"
    );
    await writeSource(
      root,
      'apps/mobile-storefront/app/.hidden/bad.ts',
      "export const bad = '/tmp/quiz-mobile/assets/svg/Logo.svg';\n"
    );
    const errors: string[] = [];

    await verifyNoReferenceImports(root, errors);

    expect(errors).toEqual([]);
  });

  it('fails fast when the source tree is unexpectedly deep', async () => {
    const root = await createTempRepo();
    let nestedDirectory = path.join(root, 'apps/mobile-storefront/app/quiz');
    await mkdir(nestedDirectory, { recursive: true });
    for (let index = 0; index < 102; index += 1) {
      nestedDirectory = path.join(nestedDirectory, index.toString(36));
      await mkdir(nestedDirectory);
    }

    await expect(verifyNoReferenceImports(root, [])).rejects.toThrow(
      'Quiz asset source walk exceeded 100 levels'
    );
  });
});
