export interface KudaBillItemLike {
  amount: number;
  itemCode: string;
  itemName: string;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: KudaBillItemLike[];
}

export interface KudaElectricityBillerLike {
  billerName: string;
  billItems?: KudaBillItemLike[];
}

interface KudaBillItemDefinition {
  itemCode: string;
  itemName: string;
}

const ELECTRICITY_BILL_ITEMS_BY_PROVIDER: Record<
  string,
  KudaBillItemDefinition[]
> = {
  AEDC: [
    { itemCode: 'KUD-ELE-AEDC-002', itemName: 'AEDC PREPAID' },
    { itemCode: 'KUD-ELE-AEDC-001', itemName: 'AEDC POSTPAID' },
  ],
  APLE: [
    { itemCode: 'KUD-ELE-APLE-002', itemName: 'APLE POSTPAID' },
    { itemCode: 'KUD-ELE-APLE-001', itemName: 'APLE PREPAID' },
  ],
  BEDC: [
    { itemCode: 'KUD-ELE-BEDC-002', itemName: 'BEDC PREPAID' },
    { itemCode: 'KUD-ELE-BEDC-001', itemName: 'BEDC POSTPAID' },
  ],
  EEDC: [
    { itemCode: 'KUD-ELE-EEDC-002', itemName: 'EEDC PREPAID' },
    { itemCode: 'KUD-ELE-EEDC-001', itemName: 'EEDC POSTPAID' },
  ],
  EKED: [
    { itemCode: 'KUD-ELE-EKED-002', itemName: 'EKEDC PREPAID' },
    { itemCode: 'KUD-ELE-EKED-001', itemName: 'EKEDC POSTPAID' },
  ],
  EKEDC: [
    { itemCode: 'KUD-ELE-EKED-002', itemName: 'EKEDC PREPAID' },
    { itemCode: 'KUD-ELE-EKED-001', itemName: 'EKEDC POSTPAID' },
  ],
  IBED: [
    { itemCode: 'KUD-ELE-IBED-002', itemName: 'IBEDC PREPAID' },
    { itemCode: 'KUD-ELE-IBED-001', itemName: 'IBEDC POSTPAID' },
  ],
  IBEDC: [
    { itemCode: 'KUD-ELE-IBED-002', itemName: 'IBEDC PREPAID' },
    { itemCode: 'KUD-ELE-IBED-001', itemName: 'IBEDC POSTPAID' },
  ],
  IKED: [
    { itemCode: 'KUD-ELE-IKED-002', itemName: 'IKEDC PREPAID' },
    { itemCode: 'KUD-ELE-IKED-001', itemName: 'IKEDC POSTPAID' },
  ],
  IKEDC: [
    { itemCode: 'KUD-ELE-IKED-002', itemName: 'IKEDC PREPAID' },
    { itemCode: 'KUD-ELE-IKED-001', itemName: 'IKEDC POSTPAID' },
  ],
  JEDC: [
    { itemCode: 'KUD-ELE-JEDC-002', itemName: 'JEDC POSTPAID' },
    { itemCode: 'KUD-ELE-JEDC-001', itemName: 'JEDC PREPAID' },
  ],
  KAED: [
    { itemCode: 'KUD-ELE-KAED-002', itemName: 'KAEDCO PREPAID' },
    { itemCode: 'KUD-ELE-KAED-001', itemName: 'KAEDCO POSTPAID' },
  ],
  KAEDC: [
    { itemCode: 'KUD-ELE-KAED-002', itemName: 'KAEDCO PREPAID' },
    { itemCode: 'KUD-ELE-KAED-001', itemName: 'KAEDCO POSTPAID' },
  ],
  KAEDCO: [
    { itemCode: 'KUD-ELE-KAED-002', itemName: 'KAEDCO PREPAID' },
    { itemCode: 'KUD-ELE-KAED-001', itemName: 'KAEDCO POSTPAID' },
  ],
  KEDC: [
    { itemCode: 'KUD-ELE-KEDC-002', itemName: 'KEDCO PREPAID' },
    { itemCode: 'KUD-ELE-KEDC-001', itemName: 'KEDCO POSTPAID' },
  ],
  KEDCO: [
    { itemCode: 'KUD-ELE-KEDC-002', itemName: 'KEDCO PREPAID' },
    { itemCode: 'KUD-ELE-KEDC-001', itemName: 'KEDCO POSTPAID' },
  ],
  PHED: [
    { itemCode: 'KUD-ELE-PHED-002', itemName: 'PHED PREPAID' },
    { itemCode: 'KUD-ELE-PHED-001', itemName: 'PHED POSTPAID' },
  ],
  YEDC: [
    { itemCode: 'KUD-ELE-YEDC-002', itemName: 'YEDC POSTPAID' },
    { itemCode: 'KUD-ELE-YEDC-001', itemName: 'YEDC PREPAID' },
  ],
};

function normalizeElectricityBillerName(billerName: string) {
  return billerName
    .trim()
    .toUpperCase()
    .replace(/\s+NG$/, '')
    .replace(/[^A-Z0-9]/g, '');
}

function createElectricityBillItem(
  item: KudaBillItemDefinition
): KudaBillItemLike {
  return {
    amount: 0,
    isAmountFixed: false,
    itemCode: item.itemCode,
    itemCurrencySymbol: 'NGN',
    itemFee: 0,
    itemName: item.itemName,
  };
}

export function withKudaElectricityBillItems<
  Biller extends KudaElectricityBillerLike,
>(billers: Biller[]): Biller[] {
  return billers.map((biller) => {
    if (biller.billItems?.length) {
      return biller;
    }

    const billItems =
      ELECTRICITY_BILL_ITEMS_BY_PROVIDER[
        normalizeElectricityBillerName(biller.billerName)
      ];
    if (!billItems) {
      return biller;
    }

    return {
      ...biller,
      billItems: billItems.map((item) => createElectricityBillItem(item)),
    };
  });
}
