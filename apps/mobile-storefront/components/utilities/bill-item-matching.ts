import type { Biller, BillItem } from '@/lib/vtu-schemas';
import { getResolvedBillItemCodes } from './bill-item-selection';

export interface InitialBillerMatch {
  biller: Biller;
  codes: string[];
  resolvedToSpecificBillItem: boolean;
}

export function findBillItemPath(
  billItems: BillItem[] | undefined,
  itemCode: string,
  path: string[] = []
): string[] | null {
  for (const billItem of billItems ?? []) {
    const nextPath = [...path, billItem.itemCode];
    if (billItem.itemCode === itemCode) {
      return nextPath;
    }

    const childPath = findBillItemPath(billItem.billItems, itemCode, nextPath);
    if (childPath) {
      return childPath;
    }
  }

  return null;
}

export function normalizeBillItemMatchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function billerNameContainsBillItemName(
  normalizedBillerName: string,
  normalizedBillItemName: string
) {
  return (
    normalizedBillItemName.length >= 3 &&
    normalizedBillerName.includes(normalizedBillItemName)
  );
}

export function getBillerMatchTokens(value: string) {
  const normalizedValue = normalizeBillItemMatchText(value);
  return normalizedValue ? normalizedValue.split(' ') : [];
}

export function startsWithCompleteBillerName(
  normalizedInitialName: string,
  normalizedBillerName: string
) {
  return (
    normalizedInitialName === normalizedBillerName ||
    normalizedInitialName.startsWith(`${normalizedBillerName} `)
  );
}

export function containsBillerNameTokenSequence(
  initialNameTokens: string[],
  billerNameTokens: string[]
) {
  if (
    billerNameTokens.length === 0 ||
    billerNameTokens.length > initialNameTokens.length
  ) {
    return false;
  }

  const maxStart = initialNameTokens.length - billerNameTokens.length;

  for (let index = 0; index <= maxStart; index += 1) {
    if (
      billerNameTokens.every(
        (token, tokenIndex) => initialNameTokens[index + tokenIndex] === token
      )
    ) {
      return true;
    }
  }

  return false;
}

export function findBillerByInitialName(
  billers: Biller[],
  initialBillerName: string
) {
  const normalizedInitialName = normalizeBillItemMatchText(initialBillerName);
  if (!normalizedInitialName) {
    return null;
  }

  const billerCandidates = billers.map((biller) => ({
    biller,
    normalizedName: normalizeBillItemMatchText(biller.billerName),
    tokens: getBillerMatchTokens(biller.billerName),
  }));
  const initialNameTokens = getBillerMatchTokens(initialBillerName);

  return (
    billerCandidates.find(
      (candidate) => candidate.normalizedName === normalizedInitialName
    )?.biller ??
    billerCandidates.find((candidate) =>
      startsWithCompleteBillerName(
        normalizedInitialName,
        candidate.normalizedName
      )
    )?.biller ??
    billerCandidates.find((candidate) =>
      containsBillerNameTokenSequence(initialNameTokens, candidate.tokens)
    )?.biller ??
    null
  );
}

export function findBillItemPathByName(
  billItems: BillItem[] | undefined,
  billerName: string,
  path: string[] = [],
  normalizedBillerName = normalizeBillItemMatchText(billerName)
): string[] | null {
  for (const billItem of billItems ?? []) {
    const nextPath = [...path, billItem.itemCode];
    const childPath = findBillItemPathByName(
      billItem.billItems,
      billerName,
      nextPath,
      normalizedBillerName
    );

    if (childPath) {
      return childPath;
    }

    const normalizedItemName = normalizeBillItemMatchText(billItem.itemName);
    if (
      billerNameContainsBillItemName(normalizedBillerName, normalizedItemName)
    ) {
      return nextPath;
    }
  }

  return null;
}

export function findInitialBillerMatch({
  billers,
  initialBillerName,
  initialBillItemIdentifier,
}: {
  billers: Biller[];
  initialBillerName?: string;
  initialBillItemIdentifier?: string;
}): InitialBillerMatch | null {
  if (initialBillItemIdentifier) {
    for (const biller of billers) {
      const path = findBillItemPath(
        biller.billItems,
        initialBillItemIdentifier
      );
      if (path) {
        return {
          biller,
          codes: path,
          resolvedToSpecificBillItem: true,
        };
      }
    }
  }

  if (!initialBillerName) {
    return null;
  }

  const biller = findBillerByInitialName(billers, initialBillerName);

  if (!biller) {
    return null;
  }

  const namePath = findBillItemPathByName(biller.billItems, initialBillerName);
  if (namePath) {
    return {
      biller,
      codes: namePath,
      resolvedToSpecificBillItem: true,
    };
  }

  return {
    biller,
    codes: getResolvedBillItemCodes(biller.billItems),
    resolvedToSpecificBillItem: false,
  };
}
