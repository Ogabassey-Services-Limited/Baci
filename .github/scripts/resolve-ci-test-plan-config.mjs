import { execFileSync } from 'node:child_process';

const CONFIG_SMOKE_FILES = [
  'turbo.json',
  '.github/scripts/resolve-ci-test-plan.mjs',
  '.github/scripts/resolve-ci-test-plan.test.mjs',
  '.github/scripts/resolve-ci-test-plan-config.mjs',
  '.github/scripts/resolve-ci-test-plan-config.test.mjs',
];

const CONFIG_SMOKE_COMMAND = [
  `pnpm exec biome check ${CONFIG_SMOKE_FILES.join(' ')}`,
  'node --test .github/scripts/resolve-ci-test-plan.test.mjs .github/scripts/resolve-ci-test-plan-config.test.mjs',
].join(' && ');

function buildEnvFrom(contents) {
  const env = contents?.tasks?.build?.env;
  if (!Array.isArray(env) || env.some((entry) => typeof entry !== 'string')) {
    return null;
  }
  return env;
}

function withoutBuildEnv(contents) {
  const clone = structuredClone(contents);
  if (clone?.tasks?.build && Object.hasOwn(clone.tasks.build, 'env')) {
    delete clone.tasks.build.env;
  }
  return clone;
}

function isTurboBuildEnvAdditionOnly(change) {
  const beforeEnv = buildEnvFrom(change?.before);
  const afterEnv = buildEnvFrom(change?.after);
  if (!beforeEnv || !afterEnv || afterEnv.length <= beforeEnv.length) {
    return false;
  }

  return (
    beforeEnv.every((entry) => afterEnv.includes(entry)) &&
    JSON.stringify(withoutBuildEnv(change.before)) ===
      JSON.stringify(withoutBuildEnv(change.after))
  );
}

function isSafeConfigSmokeChange(file, changedFileContents) {
  return (
    file === 'turbo.json' &&
    isTurboBuildEnvAdditionOnly(changedFileContents?.[file])
  );
}

function readJsonFromGit(ref, file) {
  try {
    return JSON.parse(
      execFileSync('git', ['show', `${ref}:${file}`], { encoding: 'utf8' })
    );
  } catch {
    return undefined;
  }
}

function getChangedFileContents(changedFiles, baseRef, headRef) {
  if (!changedFiles.includes('turbo.json')) {
    return {};
  }

  return {
    'turbo.json': {
      before: readJsonFromGit(baseRef, 'turbo.json'),
      after: readJsonFromGit(headRef, 'turbo.json'),
    },
  };
}

export const ciTestPlanConfig = {
  CONFIG_SMOKE_COMMAND,
  getChangedFileContents,
  isSafeConfigSmokeChange,
};
