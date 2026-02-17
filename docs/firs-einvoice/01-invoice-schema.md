# FIRS e-Invoice Schema Reference

Source: https://einvoice.nrs.gov.ng/docs/system-integrator/invoice-schema (Version 1.1)

## Overview

The e-Invoice schema is based on Universal Business Language (UBL) and supports both XML and JSON formats.

> **IMPORTANT: JSON uses snake_case for ALL field names.** XML uses PascalCase (`InvoiceTypeCode`), but JSON uses snake_case (`invoice_type_code`). This applies to every field — top-level, nested objects, and sub-fields. The field reference tables below show PascalCase (XML) names; see the [JSON Field Name Mapping](#json-field-name-mapping) section and the [Official Sample JSON](#official-sample-json-from-firs) for the exact JSON keys.
>
> **Known API typo:** In `InvoiceLine`, the discount fields are misspelled as `dicount_rate` and `dicount_amount` (missing 's') in the official JSON API. Use the misspelled versions when submitting JSON.

## Validation Endpoint

```
POST {base_url}/api/v1/invoice/validate
```

Validates invoice content before sending for signing.

---

## Field Reference

### Mandatory Fields

| # | Field | Type | Description | Example |
|---|-------|------|-------------|---------|
| 1.1 | `BusinessID` | String | Unique ID for the business issuing the invoice | `6dj03c76-1d83-4a39-a4de-51bd70547aef` |
| 1.2 | `IRN` | String | Invoice Reference Number - unique tracking number | `INV00XX-94ND90NR-20240611` |
| 1.3 | `IssueDate` | Date (YYYY-MM-DD) | Date the invoice was issued | `2024-05-14` |
| 1.6 | `InvoiceTypeCode` | String | Invoice type code | `381` |
| 1.11 | `DocumentCurrencyCode` | String | Invoice currency | `NGN` |
| 1.12 | `TaxCurrencyCode` | String | Tax calculation currency | `NGN` |
| 1.23 | `AccountingSupplierParty` | Object | Seller issuing the invoice | See below |
| 1.32 | `TaxTotal` | Object (Repeatable) | Total tax charged on the invoice | See below |
| 1.33 | `LegalMonetaryTotal` | Object | Total amount buyer has to pay | See below |
| 1.34 | `InvoiceLine` | Object (Repeatable) | Line items being invoiced | See below |

### Optional Fields

| # | Field | Type | Description | Example |
|---|-------|------|-------------|---------|
| 1.4 | `DueDate` | Date (YYYY-MM-DD) | Payment due date | `2025-03-29` |
| 1.5 | `IssueTime` | Time (HH:MM:SS) | Time the invoice was issued | `17:59:04` |
| 1.7 | `InvoiceKind` | String | Kind of invoice (B2B, B2C, etc.) | `B2B` |
| 1.8 | `PaymentStatus` | String | Payment status | `PENDING` |
| 1.9 | `Note` | String | Additional invoice note | `This invoice includes a 5% discount.` |
| 1.10 | `TaxPointDate` | Date (YYYY-MM-DD) | Date when tax becomes applicable | `2024-05-14` |
| 1.13 | `AccountingCost` | String | Accounting cost center | `2000` |
| 1.14 | `BuyerReference` | String | Buyer's reference/tracking code | `ITW001-E9E0C0D3-20240619` |
| 1.15 | `InvoiceDeliveryPeriod` | Object | Delivery period for goods/services | `{ StartDate, EndDate }` |
| 1.16 | `OrderReference` | String | Order number tied to invoice | `ITW001-E9E0C0D3-20240619` |
| 1.17 | `BillingReference` | Object (Repeatable) | Links to previous billing documents | `{ IRN, IssueDate }` |
| 1.18 | `DispatchDocumentReference` | Object | Dispatch/despatch advice reference | `{ IRN, IssueDate }` |
| 1.19 | `ReceiptDocumentReference` | Object | Receipt advice reference | `{ IRN, IssueDate }` |
| 1.20 | `OriginatorDocumentReference` | Object | Original document reference | `{ IRN, IssueDate }` |
| 1.21 | `ContractDocumentReference` | Object (Repeatable) | Contract reference | `{ IRN, IssueDate }` |
| 1.22 | `AdditionalDocumentReference` | Object | Any additional document reference | `{ IRN, IssueDate }` |
| 1.24 | `PayeeParty` | Object | Payment recipient (if different from seller) | See Party schema |
| 1.25 | `BillParty` | Object | Billing party details | See Party schema |
| 1.26 | `ShipParty` | Object | Shipping party details | See Party schema |
| 1.27 | `TaxRepresentativeParty` | Object | Tax representative details | See Party schema |
| 1.28 | `ActualDeliveryDate` | Date (YYYY-MM-DD) | Date goods/services were delivered | `2024-05-14` |
| 1.29 | `PaymentMeans` | Object (Repeatable) | How invoice will be paid | `{ PaymentMeansCode, PaymentDueDate }` |
| 1.30 | `PaymentTermsNote` | String | Payment terms and conditions | `Payment due within 30 days of invoice issue.` |
| 1.31 | `AllowanceCharge` | Object (Repeatable) | Discounts or extra charges | `{ ChargeIndicator: true }` |
| 1.35 | `AccountingCustomerParty` | Object | Buyer receiving the invoice | See Party schema |

---

## Complex Object Schemas

### Party Schema (used by AccountingSupplierParty, AccountingCustomerParty, PayeeParty, BillParty, ShipParty, TaxRepresentativeParty)

```xml
<AccountingSupplierParty>
  <PartyName>ABC Cement Ltd</PartyName>
  <Tin>RN-847789</Tin>
  <Email>supplier_business@email.com</Email>
  <Telephone>+23480254099000</Telephone>
  <BusinessDescription>Cement and building materials supplier</BusinessDescription>
  <PostalAddress>
    <StreetName>32, Owonikoko Street</StreetName>
    <CityName>Ikeja</CityName>
    <PostalZone>023401</PostalZone>
    <Country>NG</Country>
  </PostalAddress>
</AccountingSupplierParty>
```

```json
{
  "party_name": "ABC Cement Ltd",
  "tin": "RN-847789",
  "email": "supplier_business@email.com",
  "telephone": "+23480254099000",
  "business_description": "Cement and building materials supplier",
  "postal_address": {
    "street_name": "32, Owonikoko Street",
    "city_name": "Ikeja",
    "postal_zone": "023401",
    "country": "NG"
  }
}
```

**Party fields (AccountingSupplierParty):**

| # | Field | Required | Description | Example |
|---|-------|----------|-------------|---------|
| 1.22.1 | `PartyName` | **Mandatory** | Registered business name | `ABC Cement Ltd` |
| 1.22.2 | `Tin` | **Mandatory** | Tax Identification Number | `RN-847789` |
| 1.22.3 | `Email` | **Mandatory** | Official business email | `supplier@email.com` |
| 1.22.4 | `Telephone` | Optional | Phone with country code (must start with `+`) | `+23480254099000` |
| 1.22.5 | `BusinessDescription` | Optional | Line of business description | `Cement and building materials` |
| 1.22.6 | `PostalAddress` | **Mandatory** | Business address (object) | See sub-fields |
| 1.22.7 | `PostalAddress.StreetName` | **Mandatory** | Street address | `32, Owonikoko Street` |
| 1.22.8 | `PostalAddress.CityName` | **Mandatory** | City | `Ikeja` |
| 1.22.9 | `PostalAddress.PostalZone` | **Mandatory** | Postal/ZIP code | `023401` |
| 1.22.10 | `PostalAddress.LGA` | **Mandatory** | Local government area code | `NG-AB-ANO` |
| 1.22.11 | `PostalAddress.State` | **Mandatory** | State code | `NG-AB` |
| 1.22.12 | `PostalAddress.Country` | **Mandatory** | ISO 3166-1 alpha-2 country code | `NG` |

**Updated XML example with LGA and State:**

```xml
<AccountingSupplierParty>
  <PartyName>ABC Cement Ltd</PartyName>
  <Tin>RN-847789</Tin>
  <Email>supplier_business@email.com</Email>
  <Telephone>+23480254099000</Telephone>
  <BusinessDescription>Cement and building materials supplier</BusinessDescription>
  <PostalAddress>
    <StreetName>32, Owonikoko Street</StreetName>
    <CityName>Ikeja</CityName>
    <PostalZone>023401</PostalZone>
    <LGA>NG-LA-IKJ</LGA>
    <State>NG-LA</State>
    <Country>NG</Country>
  </PostalAddress>
</AccountingSupplierParty>
```

**AccountingCustomerParty** has an additional `id` field (UUID, optional) — seen in the official sample JSON as `"id": "2e41e692-0d43-4462-8317-92621e778721"`.

**PayeeParty / BillParty / ShipParty / TaxRepresentativeParty** use the same schema but without `LGA` and `State` fields (only `Country` in postal address).

### TaxTotal Schema

```xml
<TaxTotal>
  <TaxAmount>56.07</TaxAmount>
  <TaxSubtotal>
    <TaxableAmount>800</TaxableAmount>
    <TaxAmount>8</TaxAmount>
    <TaxCategory>
      <ID>LOCAL_SALES_TAX</ID>
      <Percent>2.3</Percent>
    </TaxCategory>
  </TaxSubtotal>
</TaxTotal>
```

```json
{
  "tax_amount": 56.07,
  "tax_subtotal": [
    {
      "taxable_amount": 800,
      "tax_amount": 8,
      "tax_category": {
        "id": "LOCAL_SALES_TAX",
        "percent": 2.3
      }
    }
  ]
}
```

**TaxTotal fields:**

| Field | Required | Type | Description | Example |
|-------|----------|------|-------------|---------|
| `TaxAmount` | **Mandatory** | Number (Decimal) | Total tax amount across all subtotals | `56.07` |
| `TaxSubtotal` | **Mandatory** | Array | Breakdown by tax category | See below |
| `TaxSubtotal.TaxableAmount` | **Mandatory** | Number (Decimal) | Amount subject to this tax category | `800` |
| `TaxSubtotal.TaxAmount` | **Mandatory** | Number (Decimal) | Tax amount for this category | `8` |
| `TaxSubtotal.TaxCategory.ID` | **Mandatory** | String | Tax category code (see 03-reference-data.md) | `STANDARD_VAT` |
| `TaxSubtotal.TaxCategory.Percent` | **Mandatory** | Number (Decimal) | Tax rate percentage | `7.5` |

**Baci default:** Single TaxSubtotal with `ID: "STANDARD_VAT"` and `Percent: 7.5` (Nigeria VAT rate).

### LegalMonetaryTotal Schema

```xml
<LegalMonetaryTotal>
  <LineExtensionAmount>48500</LineExtensionAmount>
  <TaxExclusiveAmount>48500</TaxExclusiveAmount>
  <TaxInclusiveAmount>52137.5</TaxInclusiveAmount>
  <PayableAmount>52137.5</PayableAmount>
</LegalMonetaryTotal>
```

```json
{
  "line_extension_amount": 48500,
  "tax_exclusive_amount": 48500,
  "tax_inclusive_amount": 52137.5,
  "payable_amount": 52137.5
}
```

**Monetary fields (all mandatory):**

| Field (XML / JSON) | Required | Type | Description | Example |
|---------------------|----------|------|-------------|---------|
| `LineExtensionAmount` / `line_extension_amount` | **Mandatory** | Number (Decimal) | Sum of all line item amounts (before tax) | `48500` |
| `TaxExclusiveAmount` / `tax_exclusive_amount` | **Mandatory** | Number (Decimal) | Total excluding tax | `48500` |
| `TaxInclusiveAmount` / `tax_inclusive_amount` | **Mandatory** | Number (Decimal) | Total including tax | `52137.5` |
| `PayableAmount` / `payable_amount` | **Mandatory** | Number (Decimal) | Final amount buyer must pay | `52137.5` |

### InvoiceLine Schema (field 1.34)

Repeatable. Each line item in the invoice. Fields numbered 1.41.x in the FIRS docs.

**InvoiceLine fields:**

| # | Field | Required | Type | Description | Example |
|---|-------|----------|------|-------------|---------|
| 1.41.1 | `HSNCode` | **Mandatory for goods** | String | Harmonized System code for the product | `1282.10` |
| 1.41.2 | `ProductCategory` | **Mandatory for goods** | String | Product category name | `Food and Beverages` |
| 1.41.3 | `ISICCode` | **Mandatory for services** | String | ISIC code for the service | `5610` |
| 1.41.4 | `ServiceCategory` | **Mandatory for services** | String | Service category name | `Construction of buildings` |
| 1.41.5 | `DiscountRate` | Mandatory | Number (Decimal) | Percentage discount on the item | `5` |
| 1.41.6 | `DiscountAmount` | Mandatory | Number (Decimal) | Discount value in currency | `2500` |
| 1.41.7 | `FeeRate` | Mandatory | Number (Decimal) | Rate of additional fees (service charge, delivery) | `2` |
| 1.41.8 | `FeeAmount` | Mandatory | Number (Decimal) | Fee charged in currency | `450` |
| 1.41.9 | `InvoicedQuantity` | Mandatory | Number (Decimal) | Number of items sold | `15` |
| 1.41.10 | `LineExtensionAmount` | Mandatory | Number (Decimal) | Total for this line before tax | `52137.5` |
| 1.41.11 | `Item` | Mandatory | Object | Item/service details | See below |
| 1.41.12 | `Price` | Mandatory | Object | Unit price details | See below |

**Item sub-object (1.41.11):**

```xml
<Item>
  <Name>50kg Bag of Rice</Name>
  <Description>Premium long-grain rice</Description>
  <SellersItemIdentification>Rice-50KG-001</SellersItemIdentification>
</Item>
```

```json
{
  "name": "50kg Bag of Rice",
  "description": "Premium long-grain rice",
  "sellers_item_identification": "Rice-50KG-001"
}
```

| Field | Description |
|-------|-------------|
| `Name` | Product/service name |
| `Description` | Detailed description |
| `SellersItemIdentification` | Seller's internal SKU/ID |

**Price sub-object (1.41.12):**

```xml
<Price>
  <PriceAmount>5000</PriceAmount>
  <BaseQuantity>1</BaseQuantity>
  <PriceUnit>NGN per 1</PriceUnit>
</Price>
```

```json
{
  "price_amount": 5000,
  "base_quantity": 1,
  "price_unit": "NGN per 1"
}
```

| Field | Description |
|-------|-------------|
| `PriceAmount` | Cost of a single unit |
| `BaseQuantity` | Base quantity for pricing (usually `1`) |
| `PriceUnit` | Currency and unit description |

**Goods vs Services:**
- For **goods**: provide `HSNCode` + `ProductCategory` (HS codes from `/api/v1/invoice/resources/hs-codes`)
- For **services**: provide `ISICCode` + `ServiceCategory` (service codes from `/api/v1/invoice/resources/services-codes`)

**Note:** `DiscountRate`, `DiscountAmount`, `FeeRate`, `FeeAmount` are all mandatory. Set to `0` when no discount/fee applies.

**Full InvoiceLine XML example:**

```xml
<InvoiceLine>
  <HSNCode>1006.30</HSNCode>
  <ProductCategory>Food and Beverages</ProductCategory>
  <DiscountRate>5</DiscountRate>
  <DiscountAmount>2500</DiscountAmount>
  <FeeRate>0</FeeRate>
  <FeeAmount>0</FeeAmount>
  <InvoicedQuantity>15</InvoicedQuantity>
  <LineExtensionAmount>52137.5</LineExtensionAmount>
  <Item>
    <Name>50kg Bag of Rice</Name>
    <Description>Premium long-grain rice</Description>
    <SellersItemIdentification>Rice-50KG-001</SellersItemIdentification>
  </Item>
  <Price>
    <PriceAmount>5000</PriceAmount>
    <BaseQuantity>1</BaseQuantity>
    <PriceUnit>NGN per 1</PriceUnit>
  </Price>
</InvoiceLine>
```

**Baci mapping per line item:**

| FIRS Field | Baci Source |
|------------|------------|
| `HSNCode` | `products.hs_code` (need to add) |
| `ProductCategory` | `products.category` or derived from business_type |
| `DiscountRate` | Calculate from `order_items.discount` |
| `DiscountAmount` | `order_items.discount` or `0` |
| `FeeRate` | `0` (fees at order level in Baci) |
| `FeeAmount` | `0` |
| `InvoicedQuantity` | `order_items.quantity` |
| `LineExtensionAmount` | `order_items.quantity * order_items.price - discount` |
| `Item.Name` | `order_items.product_name` or `products.name` |
| `Item.Description` | `products.description` |
| `Item.SellersItemIdentification` | `products.id` or `products.sku` |
| `Price.PriceAmount` | `order_items.price` |
| `Price.BaseQuantity` | `1` |
| `Price.PriceUnit` | `NGN per 1` |

### PaymentMeans Schema

```xml
<PaymentMeans>
  <PaymentMeansCode>10</PaymentMeansCode>
  <PaymentDueDate>2024-05-14</PaymentDueDate>
</PaymentMeans>
```

### InvoiceDeliveryPeriod Schema

```xml
<InvoiceDeliveryPeriod>
  <StartDate>2024-06-14</StartDate>
  <EndDate>2024-06-16</EndDate>
</InvoiceDeliveryPeriod>
```

### Document Reference Schema (used by BillingReference, DispatchDocumentReference, ReceiptDocumentReference, OriginatorDocumentReference, ContractDocumentReference, AdditionalDocumentReference)

```xml
<BillingReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</BillingReference>
```

### AllowanceCharge Schema

```xml
<AllowanceCharge>
  <ChargeIndicator>true</ChargeIndicator>
  <Amount>800.6</Amount>
</AllowanceCharge>
```

```json
{
  "charge_indicator": true,
  "amount": 800.6
}
```

| Field | Description |
|-------|-------------|
| `ChargeIndicator` / `charge_indicator` | `true` = extra charge, `false` = discount/allowance |
| `Amount` / `amount` | The monetary value of the charge or allowance |

---

## Validation Response

```xml
<status>true</status>
<message>success</message>
```

```json
{
  "status": true,
  "message": "success"
}
```

---

## Full XML Request Example

Complete validate request with all fields:

```xml
<BusinessID>6dj03c76-1d83-4a39-a4de-51bd70547aef</BusinessID>
<IRN>INV00XX-94ND90NR-20240611</IRN>
<IssueDate>2024-05-14</IssueDate>
<DueDate>2025-03-29</DueDate>
<IssueTime>17:59:04</IssueTime>
<InvoiceTypeCode>381</InvoiceTypeCode>
<PaymentStatus>PENDING</PaymentStatus>
<Note>This invoice includes a 5% discount.</Note>
<TaxPointDate>2024-05-14</TaxPointDate>
<DocumentCurrencyCode>NGN</DocumentCurrencyCode>
<TaxCurrencyCode>NGN</TaxCurrencyCode>
<AccountingCost>2000</AccountingCost>
<BuyerReference>ITW001-E9E0C0D3-20240619</BuyerReference>

<InvoiceDeliveryPeriod>
  <StartDate>2024-06-14</StartDate>
  <EndDate>2024-06-16</EndDate>
</InvoiceDeliveryPeriod>

<OrderReference>ITW001-E9E0C0D3-20240619</OrderReference>

<BillingReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</BillingReference>

<DispatchDocumentReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</DispatchDocumentReference>

<ReceiptDocumentReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</ReceiptDocumentReference>

<OriginatorDocumentReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</OriginatorDocumentReference>

<ContractDocumentReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</ContractDocumentReference>

<AdditionalDocumentReference>
  <IRN>ITW001-E9E0C0D3-20240619</IRN>
  <IssueDate>2024-05-14</IssueDate>
</AdditionalDocumentReference>

<AccountingSupplierParty>
  <PartyName>ABC Cement Ltd</PartyName>
  <Tin>RN-847789</Tin>
  <Email>supplier_business@email.com</Email>
  <Telephone>+23480254099000</Telephone>
  <BusinessDescription>Cement and building materials supplier</BusinessDescription>
  <PostalAddress>
    <StreetName>32, Owonikoko Street</StreetName>
    <CityName>Ikeja</CityName>
    <PostalZone>023401</PostalZone>
    <LGA>NG-LA-IKJ</LGA>
    <State>NG-LA</State>
    <Country>NG</Country>
  </PostalAddress>
</AccountingSupplierParty>

<PayeeParty>
  <PartyName>ABC Holdings Ltd</PartyName>
  <Tin>89487982-0001</Tin>
  <Email>paytest@email.com</Email>
  <Telephone>+23480254000000</Telephone>
  <BusinessDescription>Holding Company</BusinessDescription>
  <PostalAddress>
    <StreetName>45 Marina Road</StreetName>
    <CityName>Ikeja</CityName>
    <PostalZone>101233</PostalZone>
    <Country>NG</Country>
  </PostalAddress>
</PayeeParty>

<TaxRepresentativeParty>
  <PartyName>ABC Holdings Ltd</PartyName>
  <Tin>89487982-0001</Tin>
  <Email>tax_representative@email.com</Email>
  <Telephone>+23480254000000</Telephone>
  <BusinessDescription>Tax filings and compliance</BusinessDescription>
  <PostalAddress>
    <StreetName>12 Tax Avenue</StreetName>
    <CityName>Abuja</CityName>
    <PostalZone>900211</PostalZone>
    <Country>NG</Country>
  </PostalAddress>
</TaxRepresentativeParty>

<ActualDeliveryDate>2024-05-14</ActualDeliveryDate>

<PaymentMeans>
  <PaymentMeansCode>10</PaymentMeansCode>
  <PaymentDueDate>2024-05-14</PaymentDueDate>
</PaymentMeans>

<PaymentTermsNote>Payment due within 30 days of invoice issue.</PaymentTermsNote>

<AllowanceCharge>
  <ChargeIndicator>true</ChargeIndicator>
</AllowanceCharge>

<TaxTotal>
  <TaxAmount>56.07</TaxAmount>
  <TaxSubtotal>
    <TaxableAmount>800</TaxableAmount>
    <TaxAmount>8</TaxAmount>
    <TaxCategory>
      <ID>LOCAL_SALES_TAX</ID>
      <Percent>2.3</Percent>
    </TaxCategory>
  </TaxSubtotal>
</TaxTotal>

<LegalMonetaryTotal>
  <LineExtensionAmount>48500</LineExtensionAmount>
  <TaxExclusiveAmount>48500</TaxExclusiveAmount>
  <TaxInclusiveAmount>52137.5</TaxInclusiveAmount>
  <PayableAmount>52137.5</PayableAmount>
</LegalMonetaryTotal>

<!-- InvoiceLine: See InvoiceLine schema section -->

<AccountingCustomerParty>
  <PartyName>XYZ Construction Ltd</PartyName>
  <Tin>33467982-0001</Tin>
  <Email>customer_business@email.com</Email>
  <Telephone>+23480254000000</Telephone>
  <BusinessDescription>Construction and real estate</BusinessDescription>
  <PostalAddress>
    <StreetName>10, Banana Island</StreetName>
    <CityName>Ikoyi</CityName>
    <PostalZone>102342</PostalZone>
    <Country>NG</Country>
  </PostalAddress>
</AccountingCustomerParty>
```

---

## Baci Field Mapping

Mapping from Baci order/merchant data to FIRS e-Invoice schema:

| FIRS Field | Baci Source | Notes |
|------------|------------|-------|
| `BusinessID` | `merchants.firs_business_id` | Need to add - obtained during FIRS onboarding |
| `IRN` | Generated | Format: `{InvoiceNumber}-{ServiceID}-{YYYYMMDD}` (see 04-irn-and-signing.md) |
| `IssueDate` | `orders.created_at` | Format to YYYY-MM-DD |
| `InvoiceTypeCode` | `381` (commercial invoice) or `380` (credit note/refund) | Determine based on order type |
| `InvoiceKind` | `B2C` | Most Baci transactions are B2C |
| `PaymentStatus` | `orders.payment_status` | Map: paid→PAID, unpaid→PENDING |
| `DocumentCurrencyCode` | `NGN` | Baci currently NGN-only |
| `TaxCurrencyCode` | `NGN` | Same |
| `AccountingSupplierParty.PartyName` | `merchants.business_name` | |
| `AccountingSupplierParty.Tin` | `merchants.tin` | Need to add TIN field |
| `AccountingSupplierParty.Email` | `merchants.email` | |
| `AccountingSupplierParty.Telephone` | `merchants.phone` | |
| `AccountingSupplierParty.BusinessDescription` | `merchants.business_description` or business_type | |
| `AccountingSupplierParty.PostalAddress.StreetName` | `merchants.address` | |
| `AccountingSupplierParty.PostalAddress.CityName` | `merchants.city` | |
| `AccountingSupplierParty.PostalAddress.PostalZone` | `merchants.postal_code` | Need to add |
| `AccountingSupplierParty.PostalAddress.LGA` | `merchants.lga_code` | Need to add (e.g. `NG-LA-IKJ`) |
| `AccountingSupplierParty.PostalAddress.State` | `merchants.state_code` | Need to add (e.g. `NG-LA`) |
| `AccountingSupplierParty.PostalAddress.Country` | `NG` | Hardcoded for now |
| `AccountingCustomerParty.PartyName` | `orders.customer_name` | |
| `AccountingCustomerParty.Email` | `orders.customer_email` | |
| `AccountingCustomerParty.Telephone` | `orders.customer_phone` | |
| `TaxTotal.TaxAmount` | Calculated | VAT = 7.5% of taxable amount |
| `LegalMonetaryTotal.PayableAmount` | `orders.total` | |
| `InvoiceLine` | `order_items[]` | Map each line item |
| `OrderReference` | `orders.order_number` | |
| `ActualDeliveryDate` | `orders.shipping_date` or delivery date | |
| `PaymentMeans` | Based on `orders.payment_method` | Map to UBL payment codes |

### Missing Fields in Baci (need to add)

1. `merchants.tin` - Tax Identification Number
2. `merchants.firs_business_id` - FIRS-assigned Business ID (UUID from NRS)
3. `merchants.firs_service_id` - 8-char Service ID (for IRN generation)
4. `merchants.postal_code` - Postal/ZIP code
5. `merchants.lga_code` - Local Government Area code (e.g. `NG-LA-IKJ`) — **mandatory for FIRS**
6. `merchants.state_code` - State code (e.g. `NG-LA`) — **mandatory for FIRS**
7. `merchants.business_description` - Business activity description (optional, may use business_type)
8. `products.hs_code` - Harmonized System classification code for goods
9. IRN generation and storage - Invoice Reference Numbers
10. `merchants.firs_public_key` - RSA public key for QR code signing
11. `merchants.firs_certificate` - Certificate for QR code signing

---

## JSON Field Name Mapping

XML uses PascalCase, JSON uses snake_case. Complete mapping:

| XML (PascalCase) | JSON (snake_case) |
|-------------------|-------------------|
| `BusinessID` | `business_id` |
| `IRN` | `irn` |
| `IssueDate` | `issue_date` |
| `DueDate` | `due_date` |
| `IssueTime` | `issue_time` |
| `InvoiceTypeCode` | `invoice_type_code` |
| `InvoiceKind` | `invoice_kind` |
| `PaymentStatus` | `payment_status` |
| `Note` | `note` |
| `TaxPointDate` | `tax_point_date` |
| `DocumentCurrencyCode` | `document_currency_code` |
| `TaxCurrencyCode` | `tax_currency_code` |
| `AccountingCost` | `accounting_cost` |
| `BuyerReference` | `buyer_reference` |
| `InvoiceDeliveryPeriod` | `invoice_delivery_period` |
| `InvoiceDeliveryPeriod.StartDate` | `invoice_delivery_period.start_date` |
| `InvoiceDeliveryPeriod.EndDate` | `invoice_delivery_period.end_date` |
| `OrderReference` | `order_reference` |
| `BillingReference` | `billing_reference` |
| `DispatchDocumentReference` | `dispatch_document_reference` |
| `ReceiptDocumentReference` | `receipt_document_reference` |
| `OriginatorDocumentReference` | `originator_document_reference` |
| `ContractDocumentReference` | `contract_document_reference` |
| `AdditionalDocumentReference` | `additional_document_reference` |
| `AccountingSupplierParty` | `accounting_supplier_party` |
| `AccountingCustomerParty` | `accounting_customer_party` |
| `PayeeParty` | `payee_party` |
| `BillParty` | `bill_party` |
| `ShipParty` | `ship_party` |
| `TaxRepresentativeParty` | `tax_representative_party` |
| `ActualDeliveryDate` | `actual_delivery_date` |
| `PaymentMeans` | `payment_means` |
| `PaymentMeans.PaymentMeansCode` | `payment_means.payment_means_code` |
| `PaymentMeans.PaymentDueDate` | `payment_means.payment_due_date` |
| `PaymentTermsNote` | `payment_terms_note` |
| `AllowanceCharge` | `allowance_charge` |
| `AllowanceCharge.ChargeIndicator` | `allowance_charge.charge_indicator` |
| `AllowanceCharge.Amount` | `allowance_charge.amount` |
| `TaxTotal` | `tax_total` |
| `TaxTotal.TaxAmount` | `tax_total.tax_amount` |
| `TaxTotal.TaxSubtotal` | `tax_total.tax_subtotal` |
| `TaxSubtotal.TaxableAmount` | `tax_subtotal.taxable_amount` |
| `TaxSubtotal.TaxAmount` | `tax_subtotal.tax_amount` |
| `TaxSubtotal.TaxCategory.ID` | `tax_subtotal.tax_category.id` |
| `TaxSubtotal.TaxCategory.Percent` | `tax_subtotal.tax_category.percent` |
| `LegalMonetaryTotal` | `legal_monetary_total` |
| `LegalMonetaryTotal.LineExtensionAmount` | `legal_monetary_total.line_extension_amount` |
| `LegalMonetaryTotal.TaxExclusiveAmount` | `legal_monetary_total.tax_exclusive_amount` |
| `LegalMonetaryTotal.TaxInclusiveAmount` | `legal_monetary_total.tax_inclusive_amount` |
| `LegalMonetaryTotal.PayableAmount` | `legal_monetary_total.payable_amount` |
| `InvoiceLine` | `invoice_line` |
| `InvoiceLine.HSNCode` | `invoice_line.hsn_code` |
| `InvoiceLine.ProductCategory` | `invoice_line.product_category` |
| `InvoiceLine.ISICCode` | `invoice_line.isic_code` |
| `InvoiceLine.ServiceCategory` | `invoice_line.service_category` |
| `InvoiceLine.DiscountRate` | `invoice_line.dicount_rate` (**typo is intentional — official API**) |
| `InvoiceLine.DiscountAmount` | `invoice_line.dicount_amount` (**typo is intentional — official API**) |
| `InvoiceLine.FeeRate` | `invoice_line.fee_rate` |
| `InvoiceLine.FeeAmount` | `invoice_line.fee_amount` |
| `InvoiceLine.InvoicedQuantity` | `invoice_line.invoiced_quantity` |
| `InvoiceLine.LineExtensionAmount` | `invoice_line.line_extension_amount` |
| `InvoiceLine.Item` | `invoice_line.item` |
| `InvoiceLine.Item.Name` | `invoice_line.item.name` |
| `InvoiceLine.Item.Description` | `invoice_line.item.description` |
| `InvoiceLine.Item.SellersItemIdentification` | `invoice_line.item.sellers_item_identification` |
| `InvoiceLine.Price` | `invoice_line.price` |
| `InvoiceLine.Price.PriceAmount` | `invoice_line.price.price_amount` |
| `InvoiceLine.Price.BaseQuantity` | `invoice_line.price.base_quantity` |
| `InvoiceLine.Price.PriceUnit` | `invoice_line.price.price_unit` |
| Party `PartyName` | `party_name` |
| Party `Tin` | `tin` |
| Party `Email` | `email` |
| Party `Telephone` | `telephone` |
| Party `BusinessDescription` | `business_description` |
| Party `PostalAddress` | `postal_address` |
| `PostalAddress.StreetName` | `postal_address.street_name` |
| `PostalAddress.CityName` | `postal_address.city_name` |
| `PostalAddress.PostalZone` | `postal_address.postal_zone` |
| `PostalAddress.LGA` | `postal_address.lga` |
| `PostalAddress.State` | `postal_address.state` |
| `PostalAddress.Country` | `postal_address.country` |

---

## Official Sample JSON (from FIRS)

Complete sample invoice JSON downloaded from the FIRS e-Invoice portal. This is the **authoritative reference** for JSON field names:

```json
{
  "business_id": "72e9b677-d3d1-41dd-a526-9b5546b863b8",
  "irn": "ITW011-38A7AB43-20241010",
  "issue_date": "2024-05-14",
  "due_date": "2024-06-14",
  "invoice_type_code": "396",
  "note": "dummy_note (will be encryted in storage)",
  "tax_point_date": "2024-05-14",
  "document_currency_code": "NGN",
  "tax_currency_code": "NGN",
  "accounting_cost": "2000 NGN",
  "buyer_reference": "buyer REF IRN?",
  "invoice_delivery_period": {
    "start_date": "2024-06-14",
    "end_date": "2024-06-16"
  },
  "order_reference": "order REF IRN?",
  "billing_reference": [
    {
      "irn": "ITW001-E9E0C0D3-20240619",
      "issue_date": "2024-05-14"
    }
  ],
  "dispatch_document_reference": {
    "irn": "ITW001-E9E0C0D3-20240619",
    "issue_date": "2024-05-14"
  },
  "receipt_document_reference": {
    "irn": "ITW001-E9E0C0D3-20240619",
    "issue_date": "2024-05-14"
  },
  "originator_document_reference": {
    "irn": "ITW001-E9E0C0D3-20240619",
    "issue_date": "2024-05-14"
  },
  "contract_document_reference": {
    "irn": "ITW001-E9E0C0D3-20240619",
    "issue_date": "2024-05-14"
  },
  "additional_document_reference": [
    {
      "irn": "ITW001-E9E0C0D3-20240619",
      "issue_date": "2024-05-14"
    }
  ],
  "accounting_supplier_party": {
    "party_name": "Dangote Group",
    "tin": "TIN-000001",
    "email": "supplier_business@email.com",
    "telephone": "+23480254099000",
    "business_description": "this entity is into sales of Cement and building materials",
    "postal_address": {
      "street_name": "32, owonikoko street",
      "city_name": "Gwarikpa",
      "postal_zone": "023401",
      "country": "NG"
    }
  },
  "accounting_customer_party": {
    "id": "2e41e692-0d43-4462-8317-92621e778721",
    "party_name": "Segsalerty R",
    "tin": "TIN-000002",
    "email": "business@email.com",
    "telephone": "+23480254000000",
    "business_description": "this entity is into sales of Cement and building materials",
    "postal_address": {
      "street_name": "32, owonikoko street",
      "city_name": "Gwarikpa",
      "postal_zone": "023401",
      "country": "NG"
    }
  },
  "actual_delivery_date": "2024-05-14",
  "payment_means": [
    {
      "payment_means_code": "10",
      "payment_due_date": "2024-05-14"
    }
  ],
  "payment_terms_note": "dummy payment terms note (will be encryted in storage)",
  "allowance_charge": [
    { "charge_indicator": true, "amount": 800.6 },
    { "charge_indicator": false, "amount": 10 }
  ],
  "tax_total": [
    {
      "tax_amount": 56.07,
      "tax_subtotal": [
        {
          "taxable_amount": 800,
          "tax_amount": 8,
          "tax_category": {
            "id": "LOCAL_SALES_TAX",
            "percent": 2.3
          }
        }
      ]
    }
  ],
  "legal_monetary_total": {
    "line_extension_amount": 340.5,
    "tax_exclusive_amount": 400,
    "tax_inclusive_amount": 430,
    "payable_amount": 30
  },
  "invoice_line": [
    {
      "hsn_code": "CC-001",
      "product_category": "Food and Beverages",
      "dicount_rate": 2.01,
      "dicount_amount": 3500,
      "fee_rate": 1.01,
      "fee_amount": 50,
      "invoiced_quantity": 15,
      "line_extension_amount": 30,
      "item": {
        "name": "item name",
        "description": "item description",
        "sellers_item_identification": "identified as spoon by the seller"
      },
      "price": {
        "price_amount": 10,
        "base_quantity": 3,
        "price_unit": "NGN per 1"
      }
    }
  ]
}
```

### Key Observations from Official Sample

1. **`dicount_rate` / `dicount_amount`** — Misspelled (missing 's'). This is the actual API field name; use this exact spelling in JSON submissions.
2. **`accounting_customer_party.id`** — UUID field, not present in AccountingSupplierParty. Likely the FIRS-assigned entity ID for the buyer.
3. **`billing_reference` and `additional_document_reference`** are arrays. `contract_document_reference` and `dispatch_document_reference` are single objects.
4. **No `lga` / `state`** in postal address in this sample — these fields were documented as mandatory on the AccountingSupplierParty detail page but absent from the official JSON sample. May be validated server-side only for certain invoice types. Include them to be safe.
5. **No `invoice_kind` or `payment_status`** in this sample — confirms these are truly optional.
6. **`allowance_charge`** includes both charges (`true`) and discounts (`false`) with `amount` values.
