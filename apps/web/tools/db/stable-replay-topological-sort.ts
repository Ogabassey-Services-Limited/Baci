import { compareCodeUnitStrings } from './compare-code-unit-strings';
import type { ReplaySource } from './supabase-history-replay-types';

type ReplayBlock = {
  sortKey: string;
  sources: ReplaySource[];
};

function blockOrder(blocks: ReadonlyMap<string, ReplayBlock>) {
  return (left: string, right: string) => {
    const leftBlock = blocks.get(left);
    const rightBlock = blocks.get(right);
    if (!leftBlock || !rightBlock) {
      throw new Error('unknown replay source block');
    }
    return (
      compareCodeUnitStrings(leftBlock.sortKey, rightBlock.sortKey) ||
      compareCodeUnitStrings(left, right)
    );
  };
}

export function stableReplayTopologicalSort(
  blocks: ReadonlyMap<string, ReplayBlock>,
  edges: ReadonlyMap<string, ReadonlySet<string>>
): ReplaySource[] {
  const indegree = new Map([...blocks.keys()].map((id) => [id, 0]));
  for (const [from, destinations] of edges) {
    if (!blocks.has(from)) throw new Error('unknown replay source block');
    for (const destination of destinations) {
      if (!blocks.has(destination)) {
        throw new Error('unknown replay source block');
      }
      indegree.set(destination, (indegree.get(destination) ?? 0) + 1);
    }
  }
  const compare = blockOrder(blocks);
  const ready = [...indegree]
    .filter(([, count]) => count === 0)
    .map(([id]) => id)
    .sort(compare);
  const ordered: ReplaySource[] = [];
  let visited = 0;
  while (ready.length > 0) {
    const id = ready.shift();
    if (!id) break;
    const block = blocks.get(id);
    if (!block) throw new Error('unknown replay source block');
    ordered.push(...block.sources);
    visited += 1;
    for (const destination of edges.get(id) ?? []) {
      const next = (indegree.get(destination) ?? 0) - 1;
      indegree.set(destination, next);
      if (next === 0) {
        ready.push(destination);
        ready.sort(compare);
      }
    }
  }
  if (visited !== blocks.size) {
    throw new Error('production-effect replay relation cycle');
  }
  return ordered;
}
