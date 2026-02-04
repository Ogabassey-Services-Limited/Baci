/**
 * Optimized category sorting logic.
 *
 * Uses the Schwartzian transform pattern to pre-compute sort keys,
 * avoiding O(N log N) string allocations and repeated priority list searches.
 *
 * Sort order:
 * 1. Smartphones / Phones / Mobile (Top priority)
 * 2. Matches from priorityList (in order of priorityList)
 * 3. Alphabetical
 */
export function sortCategories(
  categories: string[],
  priorityList: string[] = []
): string[] {
  // Pre-process priority list to lower case for faster comparison
  const lowerPriorityList = priorityList.map((p) => p.toLowerCase());

  // 1. Decorate: Pre-compute sort keys
  const decorated = categories.map((name) => {
    const lowerName = name.toLowerCase().trim();

    // Check smartphone (Top Priority)
    const isSmartphone =
      lowerName === 'smartphone' ||
      lowerName === 'smartphones' ||
      lowerName.includes('phone') ||
      lowerName.includes('mobile');

    // Check priority index
    // Matches if name is EXACTLY the priority item OR contains it.
    const priorityIndex = lowerPriorityList.findIndex(
      (p) => lowerName === p || lowerName.includes(p)
    );

    return {
      name,
      lowerName,
      isSmartphone,
      priorityIndex,
    };
  });

  // 2. Sort
  decorated.sort((a, b) => {
    // 1. Smartphone logic
    if (a.isSmartphone !== b.isSmartphone) {
      return a.isSmartphone ? -1 : 1;
    }
    // If both are smartphones, sort alphabetically
    if (a.isSmartphone) {
      return a.name.localeCompare(b.name);
    }

    // 2. Navigation Priority List
    if (a.priorityIndex !== -1 && b.priorityIndex !== -1) {
      return a.priorityIndex - b.priorityIndex;
    }
    if (a.priorityIndex !== -1) return -1;
    if (b.priorityIndex !== -1) return 1;

    // 3. Alphabetical fallback
    return a.name.localeCompare(b.name);
  });

  // 3. Undecorate
  return decorated.map((d) => d.name);
}
