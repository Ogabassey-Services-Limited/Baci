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

const AEDC_ITEMS = [
  { itemCode: 'KUD-ELE-AEDC-002', itemName: 'AEDC PREPAID' },
  { itemCode: 'KUD-ELE-AEDC-001', itemName: 'AEDC POSTPAID' },
] as const;
const APLE_ITEMS = [
  { itemCode: 'KUD-ELE-APLE-002', itemName: 'APLE POSTPAID' },
  { itemCode: 'KUD-ELE-APLE-001', itemName: 'APLE PREPAID' },
] as const;
const BEDC_ITEMS = [
  { itemCode: 'KUD-ELE-BEDC-002', itemName: 'BEDC PREPAID' },
  { itemCode: 'KUD-ELE-BEDC-001', itemName: 'BEDC POSTPAID' },
] as const;
const EEDC_ITEMS = [
  { itemCode: 'KUD-ELE-EEDC-002', itemName: 'EEDC PREPAID' },
  { itemCode: 'KUD-ELE-EEDC-001', itemName: 'EEDC POSTPAID' },
] as const;
const EKED_ITEMS = [
  { itemCode: 'KUD-ELE-EKED-002', itemName: 'EKEDC PREPAID' },
  { itemCode: 'KUD-ELE-EKED-001', itemName: 'EKEDC POSTPAID' },
] as const;
const IBED_ITEMS = [
  { itemCode: 'KUD-ELE-IBED-002', itemName: 'IBEDC PREPAID' },
  { itemCode: 'KUD-ELE-IBED-001', itemName: 'IBEDC POSTPAID' },
] as const;
const IKED_ITEMS = [
  { itemCode: 'KUD-ELE-IKED-002', itemName: 'IKEDC PREPAID' },
  { itemCode: 'KUD-ELE-IKED-001', itemName: 'IKEDC POSTPAID' },
] as const;
const JEDC_ITEMS = [
  { itemCode: 'KUD-ELE-JEDC-002', itemName: 'JEDC POSTPAID' },
  { itemCode: 'KUD-ELE-JEDC-001', itemName: 'JEDC PREPAID' },
] as const;
const KAED_ITEMS = [
  { itemCode: 'KUD-ELE-KAED-002', itemName: 'KAEDCO PREPAID' },
  { itemCode: 'KUD-ELE-KAED-001', itemName: 'KAEDCO POSTPAID' },
] as const;
const KEDC_ITEMS = [
  { itemCode: 'KUD-ELE-KEDC-002', itemName: 'KEDCO PREPAID' },
  { itemCode: 'KUD-ELE-KEDC-001', itemName: 'KEDCO POSTPAID' },
] as const;
const PHED_ITEMS = [
  { itemCode: 'KUD-ELE-PHED-002', itemName: 'PHED PREPAID' },
  { itemCode: 'KUD-ELE-PHED-001', itemName: 'PHED POSTPAID' },
] as const;
const YEDC_ITEMS = [
  { itemCode: 'KUD-ELE-YEDC-002', itemName: 'YEDC POSTPAID' },
  { itemCode: 'KUD-ELE-YEDC-001', itemName: 'YEDC PREPAID' },
] as const;

const ELECTRICITY_BILL_ITEMS_BY_PROVIDER: Record<
  string,
  readonly KudaBillItemDefinition[]
> = {
  AEDC: AEDC_ITEMS,
  APLE: APLE_ITEMS,
  BEDC: BEDC_ITEMS,
  EEDC: EEDC_ITEMS,
  EKED: EKED_ITEMS,
  EKEDC: EKED_ITEMS,
  IBED: IBED_ITEMS,
  IBEDC: IBED_ITEMS,
  IKED: IKED_ITEMS,
  IKEDC: IKED_ITEMS,
  JEDC: JEDC_ITEMS,
  KAED: KAED_ITEMS,
  KAEDC: KAED_ITEMS,
  KAEDCO: KAED_ITEMS,
  KEDC: KEDC_ITEMS,
  KEDCO: KEDC_ITEMS,
  PHED: PHED_ITEMS,
  YEDC: YEDC_ITEMS,
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
