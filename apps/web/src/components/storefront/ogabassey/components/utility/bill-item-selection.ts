export interface BillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: BillItem[];
}

export interface BillItemSelectionLevel {
  depth: number;
  options: BillItem[];
  selectedCode: string | null;
}

export interface BillItemSelectionState {
  isComplete: boolean;
  leaf: BillItem | null;
  levels: BillItemSelectionLevel[];
  selectedPath: BillItem[];
}

/**
 * Finds the selected bill item, auto-selecting only when there is a single
 * available option and no explicit item code was provided.
 */
function findSelectedItem(
  options: BillItem[],
  itemCode?: string
): BillItem | null {
  if (!itemCode) {
    return options.length === 1 ? options[0] : null;
  }

  return options.find((option) => option.itemCode === itemCode) ?? null;
}

export function getResolvedBillItemCodes(
  rootItems: BillItem[] | undefined,
  preferredCodes: string[] = []
): string[] {
  if (!rootItems?.length) {
    return [];
  }

  const resolvedCodes: string[] = [];
  let options = rootItems;
  let depth = 0;

  while (options.length > 0) {
    const selectedItem = findSelectedItem(options, preferredCodes[depth]);
    if (!selectedItem) {
      break;
    }

    resolvedCodes.push(selectedItem.itemCode);

    if (!selectedItem.billItems?.length) {
      break;
    }

    options = selectedItem.billItems;
    depth += 1;
  }

  return resolvedCodes;
}

export function updateBillItemSelection(
  rootItems: BillItem[] | undefined,
  currentCodes: string[],
  depth: number,
  itemCode: string
): string[] {
  const safeDepth = Math.max(0, depth);
  const nextCodes = currentCodes.slice(0, safeDepth);
  nextCodes[safeDepth] = itemCode;
  return getResolvedBillItemCodes(rootItems, nextCodes);
}

export function resolveBillItemSelection(
  rootItems: BillItem[] | undefined,
  selectedCodes: string[]
): BillItemSelectionState {
  if (!rootItems?.length) {
    // Empty bill items are not a valid completed selection.
    return { isComplete: false, leaf: null, levels: [], selectedPath: [] };
  }

  const levels: BillItemSelectionLevel[] = [];
  const selectedPath: BillItem[] = [];
  let options = rootItems;
  let depth = 0;

  while (options.length > 0) {
    const selectedItem = findSelectedItem(options, selectedCodes[depth]);

    levels.push({
      depth,
      options,
      selectedCode: selectedItem?.itemCode ?? null,
    });

    if (!selectedItem) {
      return {
        isComplete: false,
        leaf: selectedPath.at(-1) ?? null,
        levels,
        selectedPath,
      };
    }

    selectedPath.push(selectedItem);

    if (!selectedItem.billItems?.length) {
      return { isComplete: true, leaf: selectedItem, levels, selectedPath };
    }

    options = selectedItem.billItems;
    depth += 1;
  }

  // Unreachable in normal control flow: the loop above always returns once it
  // hits a leaf or an unselected level. Kept for TypeScript exhaustiveness.
  return {
    isComplete: true,
    leaf: selectedPath.at(-1) ?? null,
    levels,
    selectedPath,
  };
}
