interface CreditDirectProductInput {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CreditDirectPreparedAmounts {
  products: Array<{
    productAmount: number;
    productId: string;
    productName: string;
  }>;
  totalAmount: number;
}

const MINOR_UNIT_SCALE = 100;

function normalizeTotalAmount(totalAmount: number): number {
  const minorUnits = totalAmount * MINOR_UNIT_SCALE;
  const roundedMinorUnits = Math.round(minorUnits);
  const normalizedAmount = roundedMinorUnits / MINOR_UNIT_SCALE;
  const floatingPointTolerance = Math.min(
    0.0001,
    Math.max(1e-7, Number.EPSILON * Math.max(1, Math.abs(totalAmount)) * 8)
  );

  if (
    !Number.isFinite(totalAmount) ||
    totalAmount <= 0 ||
    !Number.isSafeInteger(roundedMinorUnits) ||
    Math.abs(totalAmount - normalizedAmount) > floatingPointTolerance
  ) {
    throw new Error(
      'Credit Direct checkout amount must use at most two decimal places'
    );
  }

  return normalizedAmount;
}

export function prepareCreditDirectAmounts(
  items: CreditDirectProductInput[],
  totalAmount: number
): CreditDirectPreparedAmounts {
  const normalizedAmount = normalizeTotalAmount(totalAmount);
  const targetMinorUnits = Math.round(normalizedAmount * MINOR_UNIT_SCALE);
  const itemMinorUnits = items.map((item) =>
    Math.round(item.price * item.quantity * MINOR_UNIT_SCALE)
  );
  const itemsTotalMinorUnits = itemMinorUnits.reduce(
    (sum, amount) => sum + amount,
    0
  );

  if (
    items.length === 0 ||
    itemMinorUnits.some((amount) => !Number.isFinite(amount) || amount < 0) ||
    !Number.isSafeInteger(itemsTotalMinorUnits)
  ) {
    throw new Error(
      'Credit Direct checkout requires items with a positive total'
    );
  }

  if (targetMinorUnits < items.length) {
    throw new Error(
      'Credit Direct checkout total cannot allocate a positive amount to every item'
    );
  }

  const allocationWeights =
    itemsTotalMinorUnits === 0 ? itemMinorUnits.map(() => 1) : itemMinorUnits;
  const allocationWeightTotal =
    itemsTotalMinorUnits === 0 ? items.length : itemsTotalMinorUnits;
  let allocatedMinorUnits = 0;
  const products = items.map((item, index) => {
    const isLastItem = index === items.length - 1;
    const remainingProductCount = items.length - index - 1;
    const proportionalMinorUnits = Number(
      (BigInt(targetMinorUnits) * BigInt(allocationWeights[index])) /
        BigInt(allocationWeightTotal)
    );
    const productMinorUnits = isLastItem
      ? targetMinorUnits - allocatedMinorUnits
      : Math.min(
          Math.max(1, proportionalMinorUnits),
          targetMinorUnits - allocatedMinorUnits - remainingProductCount
        );
    allocatedMinorUnits += productMinorUnits;

    return {
      productId: item.id,
      productName: item.name,
      productAmount: productMinorUnits / MINOR_UNIT_SCALE,
    };
  });

  return { products, totalAmount: normalizedAmount };
}
