// biome-ignore-all format: compact bounded pagination stays below the repository limit
import { API, exact, fail, hash } from './owner-api-transport-primitives.mjs';
import { listPath } from './owner-api-transport-requests.mjs';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

function pageNumber(state, operation) {
  const target = state.pageCursors?.[operation];
  if (!target) return 1;
  const value = new URL(`${API}/repos/${state.repository.name}${target}`).searchParams.get('page');
  return /^[1-9][0-9]*$/.test(value) ? Number(value) : fail('invalid page cursor');
}

function targetFor(state, operation, raw) {
  const target = new URL(raw, API); const page = target.searchParams.get('page');
  if (!/^[1-9][0-9]*$/.test(page) || Number(page) > MAX_PAGES || target.href !== `${API}/repos/${state.repository.name}${listPath(state, operation, Number(page))}` || target.username || target.password || target.hash) fail('invalid Link target');
  return { page: Number(page), suffix: `${target.pathname.slice(`/repos/${state.repository.name}`.length)}${target.search}` };
}

function linksFor(state, operation, response, current, needed) {
  const raw = response?.linkValues ?? [];
  if (!Array.isArray(raw) || raw.length > 1 || raw.some((value) => typeof value !== 'string' || value.length > 8192 || /[\r\n]/.test(value))) fail('invalid Link target');
  const entries = raw.length ? raw[0].split(/,\s*/) : [];
  const links = {};
  for (const entry of entries) {
    const match = /^<([^<>]+)>; rel="(first|prev|next|last)"$/.exec(entry);
    if (!match || links[match[2]]) fail('invalid Link target');
    links[match[2]] = targetFor(state, operation, match[1]);
  }
  const expected = { first: 1, prev: current - 1, next: current + 1, last: needed };
  for (const [relation, target] of Object.entries(links)) if (target.page !== expected[relation] || target.page < 1 || target.page > needed) fail('invalid Link target');
  if ((current < needed) !== Boolean(links.next)) fail('incomplete pagination');
  return { digest: hash(JSON.stringify(raw)), next: links.next?.suffix };
}

export function appendCollectionPage(state, operation, response, key) {
  const body = response?.body; const current = pageNumber(state, operation); const prior = state.pageCollections?.[operation] ?? []; const proofs = state.pageProofs?.[operation] ?? [];
  if (!exact(body, [key, 'total_count']) || !Number.isInteger(body.total_count) || body.total_count < 0 || body.total_count > MAX_PAGES * PAGE_SIZE || !Array.isArray(body[key])) fail('invalid paginated response');
  const needed = Math.max(1, Math.ceil(body.total_count / PAGE_SIZE)); const size = current === needed ? body.total_count - (current - 1) * PAGE_SIZE : PAGE_SIZE;
  if (current !== prior.length + 1 || current > needed || body[key].length !== size || prior.some((page) => page.total_count !== body.total_count)) fail('incomplete pagination');
  const all = [...prior, body]; const rows = all.flatMap((page) => page[key]); const ids = rows.map((row) => row?.id);
  if (ids.some((id) => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) fail('duplicate pagination row');
  const link = linksFor(state, operation, response, current, needed); const nextProofs = [...proofs, { linkSha256: link.digest, page: current, target: listPath(state, operation, current) }];
  if (current < needed) return { complete: false, cursor: link.next, pages: all, proofs: nextProofs };
  return { body: { [key]: rows, total_count: body.total_count }, complete: true, pages: all, proofs: nextProofs };
}
