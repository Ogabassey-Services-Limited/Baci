type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

type HeadingStackEntry = {
  sourceLevel: HeadingLevel;
  normalizedLevel: HeadingLevel;
};

function toHeadingLevel(level: number): HeadingLevel {
  return Math.min(6, Math.max(1, level)) as HeadingLevel;
}

/**
 * Creates a document-order heading normalizer for sanitized legacy article HTML.
 *
 * The page template owns the page-level h1, so body headings start at h2. The
 * normalizer closes skipped forward levels while preserving valid deeper
 * subsections and sibling source levels.
 */
export function createHeadingHierarchyNormalizer() {
  const stack: HeadingStackEntry[] = [];

  return (rawSourceLevel: number): HeadingLevel => {
    const sourceLevel = toHeadingLevel(rawSourceLevel);
    let normalizedLevel: HeadingLevel;

    if (sourceLevel === 1) {
      normalizedLevel = 2;
      stack.length = 0;
    } else {
      const sameLevelEntry = [...stack]
        .reverse()
        .find((entry) => entry.sourceLevel === sourceLevel);
      const parentEntry = [...stack]
        .reverse()
        .find((entry) => entry.sourceLevel < sourceLevel);

      if (sameLevelEntry) {
        normalizedLevel = sameLevelEntry.normalizedLevel;
      } else if (parentEntry) {
        normalizedLevel = toHeadingLevel(parentEntry.normalizedLevel + 1);
      } else {
        normalizedLevel = 2;
      }

      while (
        stack.length > 0 &&
        stack[stack.length - 1]?.sourceLevel >= sourceLevel
      ) {
        stack.pop();
      }
    }

    stack.push({ sourceLevel, normalizedLevel });
    return normalizedLevel;
  };
}
