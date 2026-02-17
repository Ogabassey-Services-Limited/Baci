# FIRS e-Invoice Reference Data

Source: https://einvoice.nrs.gov.ng/docs (Version 1.1)

All reference data endpoints require headers: `x-api-key`, `x-api-secret`

---

## 1. Invoice Types

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/invoice-types`

| Code | Value | Description |
|------|-------|-------------|
| `380` | Credit Note | Credit Note |
| `381` | Commercial Invoice | **Standard invoice — Baci default** |
| `384` | Debit Note | Debit Note |
| `385` | Self Billed Invoice | Self Billed Invoice |
| `386` | Factored Invoice | Factored Invoice |
| `388` | Statement of Account | Statement of Account |
| `389` | Purchase Order | Purchase Order |
| `390` | Proforma Invoice | Proforma Invoice |
| `392` | Consignment Invoice | Consignment Invoice |
| `393` | Self-billed Credit Note | Self-billed Credit Note |
| `394` | Self-billed Invoice | Self-billed Invoice |
| `395` | Credit Note Request | Credit Note Request |
| `396` | Invoice Request | Invoice Request |
| `397` | Final Settlement | Final Settlement |
| `399` | Bill of Lading | Bill of Lading |
| `400` | Waybill | Waybill |
| `402` | Shipping Instructions | Shipping Instructions |
| `404` | Certificate of Origin | Certificate of Origin |
| `406` | Customs Declaration | Customs Declaration |
| `408` | Packing List | Packing List |

**Baci mapping:** Most orders → `381` (Commercial Invoice). Refunds → `380` (Credit Note).

**Response format:**
```json
[
  { "code": "381", "value": "Commercial Invoice" }
]
```

---

## 2. Payment Means

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/payment_means`

| Code | Value | Baci Mapping |
|------|-------|--------------|
| `10` | Cash | `payment_method = 'cash'` |
| `20` | Cheque | — |
| `30` | Credit Transfer | `payment_method = 'bank_transfer'` |
| `31` | Debit Transfer | — |
| `42` | ACH Credit | — |
| `43` | ACH Debit | — |
| `48` | Bank Card | `payment_method = 'card'` |
| `49` | Direct Debit | — |
| `50` | Credit Card | `payment_method = 'card'` (alt) |
| `58` | Banker's Draft | — |
| `97` | Other | Default fallback |
| `ZZZ` | Mutually Defined | — |

**Baci payment method → FIRS code mapping:**
```typescript
const PAYMENT_MEANS_MAP: Record<string, string> = {
  'cash': '10',
  'bank_transfer': '30',
  'card': '48',
  'paystack': '48',    // card-based
  'korapay': '30',     // bank transfer / VBA
  'pos': '48',         // card terminal
  'credit': '97',      // ship-on-credit
  'default': '97',     // Other
};
```

**Response format:**
```json
[
  { "code": "10", "value": "Cash" }
]
```

---

## 3. Tax Categories

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/tax-categories`

| Code | Value | Baci Relevance |
|------|-------|----------------|
| `STANDARD_VAT` | Standard Value-Added Tax | **Primary — Nigeria VAT 7.5%** |
| `REDUCED_VAT` | Reduced Value-Added Tax | Some goods |
| `ZERO_VAT` | Zero Value-Added Tax | VAT-exempt goods |
| `STANDARD_GST` | Standard Goods and Services Tax | — |
| `REDUCED_GST` | Reduced Goods and Services Tax | — |
| `ZERO_GST` | Zero Goods and Services Tax | — |
| `STATE_SALES_TAX` | State Sales Tax | — |
| `LOCAL_SALES_TAX` | Local Sales Tax | — |
| `ALCOHOL_EXCISE_TAX` | Alcohol Excise Tax | Alcohol merchants |
| `TOBACCO_EXCISE_TAX` | Tobacco Excise Tax | — |
| `FUEL_EXCISE_TAX` | Fuel Excise Tax | — |
| `CORPORATE_INCOME_TAX` | Corporate Income Tax | — |
| `PERSONAL_INCOME_TAX` | Personal Income Tax | — |
| `SOCIAL_SECURITY_TAX` | Social Security Tax | — |
| `MEDICARE_TAX` | Medicare Tax | — |
| `REAL_ESTATE_TAX` | Real Estate Tax | — |
| `PERSONAL_PROPERTY_TAX` | Personal Property Tax | — |
| `CARBON_TAX` | Carbon Tax | — |
| `PLASTIC_TAX` | Plastic Tax | — |
| `IMPORT_DUTY` | Import Duty | — |
| `EXPORT_DUTY` | Export Duty | — |
| `LUXURY_TAX` | Luxury Tax | — |
| `SERVICE_TAX` | Service Tax | Service businesses |
| `TOURISM_TAX` | Tourism Tax | — |

**Baci default:** `STANDARD_VAT` at 7.5% for most B2C transactions.

**Response format:**
```json
[
  { "code": "STANDARD_VAT", "value": "Standard Value-Added Tax" }
]
```

---

## 4. Currencies

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/currencies`

Returns full ISO 4217 currency list. Key currencies for Baci:

| Code | Name | Symbol |
|------|------|--------|
| `NGN` | Nigerian Naira | ₦ |
| `USD` | US Dollar | $ |
| `GBP` | British Pound Sterling | £ |
| `EUR` | Euro | € |
| `GHS` | Ghanaian Cedi | GH₵ |
| `KES` | Kenyan Shilling | Ksh |
| `ZAR` | South African Rand | — |

**Baci default:** `NGN`. Both `DocumentCurrencyCode` and `TaxCurrencyCode` set to `NGN`.

**Response format:**
```json
[
  {
    "symbol": "₦",
    "name": "Nigerian Naira",
    "symbol_native": "₦",
    "decimal_digits": 2,
    "rounding": 0,
    "code": "NGN",
    "name_plural": "Nigerian nairas"
  }
]
```

---

## 5. Product Codes (HS Codes)

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/hs-codes`

Harmonized System (HS) codes for goods classification. Returns thousands of entries.

**Sample entries:**

| HS Code | Description |
|---------|-------------|
| `0101.21` | Horses; live, pure-bred breeding animals |
| `0101.29` | Horses; live, other than pure-bred breeding animals |
| `0102.21` | Cattle; live, pure-bred breeding animals |
| `0103.10` | Swine; live, pure-bred breeding animals |
| `0104.10` | Sheep; live |
| `0104.20` | Goats; live |
| `0105.11` | Poultry; live fowls, weighing not more than 185g |

**Response format:**
```json
{
  "code": 200,
  "data": [
    {
      "hscode": "0101.21",
      "description": "Horses; live, pure-bred breeding animals"
    }
  ]
}
```

**Baci integration:** Products need an optional `hs_code` field. For MVP, use a search/autocomplete dropdown. Most Baci merchants sell consumer goods — relevant HS chapters include:
- Chapter 15-24: Food products
- Chapter 33: Cosmetics
- Chapter 61-62: Clothing
- Chapter 84-85: Electronics
- Chapter 94-96: Furniture, misc manufactured goods

---

## 6. Service Codes

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/services-codes`

ISIC-based service classification codes. For service-based businesses.

**Sample entries:**

| Code | Description |
|------|-------------|
| `0111` | Growing of cereals, leguminous crops and oil seeds |
| `0112` | Growing of rice |
| `0113` | Growing of vegetables and melons, roots and tubers |
| `0121` | Growing of grapes |
| `0122` | Growing of tropical and subtropical fruits |
| `0123` | Growing of citrus fruits |
| `0124` | Growing of pome fruits and stone fruits |

**Response format:**
```json
{
  "code": 200,
  "data": [
    {
      "description": "Growing of cereals (except rice), leguminous crops and oil seeds",
      "code": "0111"
    }
  ]
}
```

**Baci integration:** For service-type businesses, the `service_code` maps to the merchant's `business_type`. Could be auto-suggested based on business category.

---

## 7. Nigerian States

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/states`

| Name | Code |
|------|------|
| Abia | `NG-AB` |
| Adamawa | `NG-AD` |
| Akwa Ibom | `NG-AK` |
| Anambra | `NG-AN` |
| Bauchi | `NG-BA` |
| Bayelsa | `NG-BY` |
| Benue | `NG-BE` |
| Borno | `NG-BO` |
| Cross River | `NG-CR` |
| Delta | `NG-DE` |
| Ebonyi | `NG-EB` |
| Edo | `NG-ED` |
| Ekiti | `NG-EK` |
| Enugu | `NG-EN` |
| FCT | `NG-FC` |
| Gombe | `NG-GO` |
| Imo | `NG-IM` |
| Jigawa | `NG-JI` |
| Kaduna | `NG-KD` |
| Kano | `NG-KN` |
| Katsina | `NG-KT` |
| Kebbi | `NG-KE` |
| Kogi | `NG-KO` |
| Kwara | `NG-KW` |
| Lagos | `NG-LA` |
| Nasarawa | `NG-NA` |
| Niger | `NG-NI` |
| Ogun | `NG-OG` |
| Ondo | `NG-ON` |
| Osun | `NG-OS` |
| Oyo | `NG-OY` |
| Plateau | `NG-PL` |
| Rivers | `NG-RI` |
| Sokoto | `NG-SO` |
| Taraba | `NG-TA` |
| Yobe | `NG-YO` |
| Zamfara | `NG-ZA` |

**Response format:**
```json
{
  "code": 200,
  "data": [
    { "name": "Lagos", "code": "NG-LA" }
  ]
}
```

---

## 8. Local Government Areas (LGAs)

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/lgas`

Returns all 774 Nigerian LGAs with state association.

**Sample entries:**

| Name | Code | State Code |
|------|------|------------|
| Aba North | `NG-AB-ANO` | `NG-AB` |
| Aba South | `NG-AB-ASO` | `NG-AB` |
| Arochukwu | `NG-AB-ARO` | `NG-AB` |
| Bende | `NG-AB-BEN` | `NG-AB` |

**Response format:**
```json
{
  "code": 200,
  "data": [
    {
      "name": "Aba North",
      "code": "NG-AB-ANO",
      "state_code": "NG-AB"
    }
  ]
}
```

**Baci integration:** Useful for `PostalAddress` on the supplier/customer party. Could enhance merchant address forms with state/LGA dropdowns.

---

## 9. Countries

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/countries`

Returns ISO 3166-1 alpha-2 country codes.

**Baci default:** `NG` (Nigeria) for all supplier parties.

---

## 10. VAT Exemptions

**Endpoint:** `GET {base_url}/api/v1/invoice/resources/vat-exemptions`

Returns reasons for VAT exemption. Used when `TaxCategory` is `ZERO_VAT`.

---

## Baci Caching Strategy

All reference data should be cached locally:

```typescript
// Cache in Supabase table or in-memory
interface FirsReferenceData {
  invoice_types: { code: string; value: string }[];
  payment_means: { code: string; value: string }[];
  tax_categories: { code: string; value: string }[];
  currencies: { code: string; name: string; symbol: string }[];
  hs_codes: { hscode: string; description: string }[];
  service_codes: { code: string; description: string }[];
  states: { name: string; code: string }[];
  lgas: { name: string; code: string; state_code: string }[];
}

// Refresh: daily or on-demand
// Storage: Supabase table `firs_reference_data` with JSON columns
// Or: static JSON files bundled at build time (smaller subset)
```

**HS Codes note:** The full HS code list is very large (5,000+ entries). For the product form, use a search/autocomplete component rather than loading all codes at once.
