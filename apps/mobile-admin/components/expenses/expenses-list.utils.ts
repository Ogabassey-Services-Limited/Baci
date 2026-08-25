import type { Expense } from '@/schemas/expense';
import type { ExpenseGroup } from '@/schemas/expense-group';

export type GroupedExpenseListItem =
  | {
      type: 'header';
      key: string;
      monthKey: string;
      title: string;
      total: number;
      count: number;
    }
  | {
      type: 'group-header';
      key: string;
      monthKey: string;
      groupKey: string;
      title: string;
      total: number;
      count: number;
    }
  | {
      type: 'item';
      key: string;
      data: Expense;
    };

export function parseDateOnlyParts(value: string): {
  year: number;
  month: number;
  day: number;
} | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getLocalMonthKey(value: string | Date): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();

    // Strict calendar date-only check first
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      const dateOnlyParts = parseDateOnlyParts(trimmedValue);
      if (!dateOnlyParts) {
        return null;
      }
      const month = String(dateOnlyParts.month).padStart(2, '0');
      return `${dateOnlyParts.year}-${month}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${year}-${month}`;
}

export function getExpenseDateSortValue(value: string | Date): number {
  if (typeof value === 'string') {
    const dateOnlyParts = parseDateOnlyParts(value);

    if (dateOnlyParts) {
      return new Date(
        dateOnlyParts.year,
        dateOnlyParts.month - 1,
        dateOnlyParts.day
      ).getTime();
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getMonthGroupTitle(
  monthKey: string,
  currentMonthKey: string | null
): string {
  if (monthKey === 'unknown') {
    return 'Unknown Month';
  }

  if (monthKey === currentMonthKey) {
    return 'This Month';
  }

  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
}

export function groupExpensesByMonth(
  expensesList: Expense[],
  now = new Date()
): {
  data: GroupedExpenseListItem[];
  stickyHeaderIndices: number[];
} {
  const groups = new Map<string, Expense[]>();

  for (const expense of expensesList) {
    const monthKey = getLocalMonthKey(expense.date) ?? 'unknown';

    const existing = groups.get(monthKey);
    if (existing) {
      existing.push(expense);
    } else {
      groups.set(monthKey, [expense]);
    }
  }

  const currentMonthKey = getLocalMonthKey(now);
  const data: GroupedExpenseListItem[] = [];
  const stickyHeaderIndices: number[] = [];

  // Sort month keys descending, putting 'unknown' at the end
  const sortedMonthKeys = [...groups.keys()]
    .filter((k) => k !== 'unknown')
    .sort((a, b) => b.localeCompare(a));

  if (groups.has('unknown')) {
    sortedMonthKeys.push('unknown');
  }

  for (const monthKey of sortedMonthKeys) {
    stickyHeaderIndices.push(data.length);

    data.push({
      type: 'header',
      key: `expenses-header-${monthKey}`,
      monthKey,
      title: getMonthGroupTitle(monthKey, currentMonthKey),
      total: (groups.get(monthKey) ?? []).reduce(
        (sum, expense) => sum + expense.amount,
        0
      ),
      count: groups.get(monthKey)?.length ?? 0,
    });

    const groupExpenses = [...(groups.get(monthKey) ?? [])]
      .map((expense) => ({
        expense,
        sortValue: getExpenseDateSortValue(expense.date),
      }))
      .sort((a, b) => b.sortValue - a.sortValue)
      .map(({ expense }) => expense);

    for (const expense of groupExpenses) {
      data.push({
        type: 'item',
        key: `expense-item-${expense.id}`,
        data: expense,
      });
    }
  }

  return { data, stickyHeaderIndices };
}

type ExpenseGroupOption = Pick<ExpenseGroup, 'id' | 'name'>;

function getExpenseGroupKey(
  expense: Expense,
  groupsById: Map<string, ExpenseGroupOption>
): { key: string; title: string } {
  if (expense.group_id) {
    const group = groupsById.get(expense.group_id);
    if (group) {
      return { key: `group-${group.id}`, title: group.name };
    }
  }

  return {
    key: `category-${expense.category}`,
    title: expense.category,
  };
}

export function groupExpensesByMonthAndGroup(
  expensesList: Expense[],
  groups: ExpenseGroupOption[],
  now = new Date()
): {
  data: GroupedExpenseListItem[];
  stickyHeaderIndices: number[];
} {
  const expensesByMonth = new Map<string, Expense[]>();
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  for (const expense of expensesList) {
    const monthKey = getLocalMonthKey(expense.date) ?? 'unknown';
    const monthExpenses = expensesByMonth.get(monthKey);
    if (monthExpenses) {
      monthExpenses.push(expense);
    } else {
      expensesByMonth.set(monthKey, [expense]);
    }
  }

  const currentMonthKey = getLocalMonthKey(now);
  const data: GroupedExpenseListItem[] = [];
  const stickyHeaderIndices: number[] = [];
  const sortedMonthKeys = [...expensesByMonth.keys()]
    .filter((key) => key !== 'unknown')
    .sort((a, b) => b.localeCompare(a));

  if (expensesByMonth.has('unknown')) {
    sortedMonthKeys.push('unknown');
  }

  for (const monthKey of sortedMonthKeys) {
    const monthExpenses = [...(expensesByMonth.get(monthKey) ?? [])].sort(
      (a, b) =>
        getExpenseDateSortValue(b.date) - getExpenseDateSortValue(a.date)
    );
    stickyHeaderIndices.push(data.length);
    data.push({
      type: 'header',
      key: `expenses-header-${monthKey}`,
      monthKey,
      title: getMonthGroupTitle(monthKey, currentMonthKey),
      total: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
      count: monthExpenses.length,
    });

    const expensesByGroup = new Map<
      string,
      { title: string; expenses: Expense[] }
    >();
    for (const expense of monthExpenses) {
      const group = getExpenseGroupKey(expense, groupsById);
      const groupExpenses = expensesByGroup.get(group.key);
      if (groupExpenses) {
        groupExpenses.expenses.push(expense);
      } else {
        expensesByGroup.set(group.key, {
          title: group.title,
          expenses: [expense],
        });
      }
    }

    for (const [groupKey, group] of expensesByGroup) {
      data.push({
        type: 'group-header',
        key: `expenses-group-header-${monthKey}-${groupKey}`,
        monthKey,
        groupKey,
        title: group.title,
        total: group.expenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: group.expenses.length,
      });
      for (const expense of group.expenses) {
        data.push({
          type: 'item',
          key: `expense-item-${expense.id}`,
          data: expense,
        });
      }
    }
  }

  return { data, stickyHeaderIndices };
}
