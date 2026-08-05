#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

const SHA_PATTERN = /^[0-9a-f]{40}$/i;
const REPOSITORY_PATTERN = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

function required(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`missing ${label}`);
  }
  return value;
}

function safeApiUrl(value) {
  const url = new URL(value ?? 'https://api.github.com');
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('invalid GitHub API URL');
  }
  return url.href.replace(/\/$/, '');
}

export async function verifyCurrentMainDeployment({
  apiUrl,
  expectedSha,
  fetchImpl = globalThis.fetch,
  repository,
  token,
}) {
  if (!SHA_PATTERN.test(required(expectedSha, 'deployment SHA'))) {
    throw new Error('invalid deployment SHA');
  }
  if (!REPOSITORY_PATTERN.test(required(repository, 'GitHub repository'))) {
    throw new Error('invalid GitHub repository');
  }
  required(token, 'GitHub token');
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is unavailable');
  }

  const response = await fetchImpl(
    `${safeApiUrl(apiUrl)}/repos/${repository}/git/ref/heads/main`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'user-agent': 'baci-current-main-deploy-guard',
        'x-github-api-version': '2022-11-28',
      },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!response.ok) {
    throw new Error(
      `GitHub main-ref lookup failed with status ${response.status}`
    );
  }

  const body = await response.json();
  const currentSha = body?.object?.sha;
  if (typeof currentSha !== 'string' || !SHA_PATTERN.test(currentSha)) {
    throw new Error('invalid current main SHA');
  }
  if (currentSha.toLowerCase() !== expectedSha.toLowerCase()) {
    throw new Error(
      `superseded deployment SHA ${expectedSha}; current main is ${currentSha}`
    );
  }

  return { currentSha, expectedSha };
}

function escapeWorkflowCommand(value) {
  return value
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
}

async function main() {
  try {
    const result = await verifyCurrentMainDeployment({
      apiUrl: process.env.GITHUB_API_URL,
      expectedSha: process.env.GITHUB_SHA,
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
    });
    console.log(
      `Exact-main deployment guard accepted ${result.expectedSha} for production.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown refusal';
    console.error(
      `::error title=Production deployment refused::${escapeWorkflowCommand(message)}`
    );
    process.exitCode = 78;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
