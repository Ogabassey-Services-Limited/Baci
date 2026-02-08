export interface SortCategoriesOptions {
  categories: string[];
  priorityList?: string[];
}

const SMARTPHONE_SET = new Set([
  'smartphone',
  'smartphones',
  'mobile phone',
  'mobile phones',
  'cell phone',
]);

export function sortCategories({
  categories,
  priorityList = [],
}: SortCategoriesOptions): string[] {
  if (categories.length === 0) return [];

  const decorated = categories.map((cat) => {
    const lower = cat.toLowerCase().trim();
    const isSmartphone = SMARTPHONE_SET.has(lower);
    const priorityIndex = priorityList.indexOf(lower);
    return { original: cat, lower, isSmartphone, priorityIndex };
  });

  decorated.sort((a, b) => {
    if (a.isSmartphone && !b.isSmartphone) return -1;
    if (!a.isSmartphone && b.isSmartphone) return 1;

    const aHasPriority = a.priorityIndex !== -1;
    const bHasPriority = b.priorityIndex !== -1;
    if (aHasPriority && bHasPriority) return a.priorityIndex - b.priorityIndex;
    if (aHasPriority) return -1;
    if (bHasPriority) return 1;

    return a.lower.localeCompare(b.lower, 'en', { sensitivity: 'base' });
  });

  return decorated.map((d) => d.original);
}
