# FIRS e-Invoice API Endpoints Reference

Source: Postman Collection (https://documenter.getpostman.com/view/38144164/2sAXqtagFx)

## Base Configuration

```
Base URL: {{HOST}}  (sandbox/production TBD)
```

### Authentication Headers (all requests)

```
x-api-key: {{API_KEY}}
x-api-secret: {{API_SECRET}}
```

### Format Support

- Default: JSON (`application/json`)
- XML: Set `Accept: application/xml` header
- Most endpoints have both JSON and XML variants

---

## 1. Authentication

### POST TaxpayerLogin

```
POST {base_url}/api/v1/utilities/authenticate
```

**Headers:**
```
x-api-key: {{API_KEY}}
x-api-secret: {{API_SECRET}}
```

**Body (JSON):**
```json
{
  "email": "{{TAXPAYER_EMAIL}}",
  "password": "{{TAXPAYER_PASSWORD}}"
}
```

**Notes:** Authenticates a taxpayer. Likely returns a session token for subsequent requests.

---

## 2. Entity Management

Endpoints for managing business entities in the e-invoice system.

### GET GetEntity

```
GET {base_url}/api/v1/entity/{entity_id}
```

**Headers:**
```
x-api-key: {{API_KEY}}
x-api-secret: {{API_SECRET}}
```

**Example:** `GET /api/v1/entity/cd921b8f-3d8a-48ca-841f-9445c6e9c5ff`

### GET SearchEntity

```
GET {base_url}/api/v1/entity?size=20&page=1&sort_by=created_at&sort_direction_desc=true&reference=
```

**Headers:**
```
x-api-key: {{API_KEY}}
x-api-secret: {{API_SECRET}}
```

**Query Parameters:**

| Param | Type | Description | Example |
|-------|------|-------------|---------|
| `size` | Number | Items per page | `20` |
| `page` | Number | Page number | `1` |
| `sort_by` | String | Sort field | `created_at` |
| `sort_direction_desc` | Boolean | Sort descending | `true` |
| `reference` | String | Search by reference | `` |

**XML variants:** Same endpoints with `Accept: application/xml` header.

---

## 3. Resources (Lookup/Reference Data)

Static reference data endpoints. Use these to populate dropdowns and validate codes.

| Endpoint | Method | Path | Description |
|----------|--------|------|-------------|
| GetInvoiceTypes | GET | `/api/v1/invoice/resources/invoice-types` | Invoice type codes (380, 381, etc.) |
| GetPaymentMeans | GET | `/api/v1/invoice/resources/payment_means` | Payment method codes (10=Cash, 48=Bank Card, etc.) |
| GetTaxCategories | GET | `/api/v1/invoice/resources/tax-categories` | Tax category IDs (STANDARD_VAT, etc.) |
| GetCurrencies | GET | `/api/v1/invoice/resources/currencies` | ISO 4217 currency list with symbols |
| GetProductCodes | GET | `/api/v1/invoice/resources/hs-codes` | Harmonized System (HS) product codes |
| GetServiceCodes | GET | `/api/v1/invoice/resources/services-codes` | ISIC service classification codes |
| GetStates | GET | `/api/v1/invoice/resources/states` | Nigerian state codes (NG-LA, etc.) |
| GetLGAs | GET | `/api/v1/invoice/resources/lgas` | Nigerian LGA codes with state association |
| GetCountries | GET | `/api/v1/invoice/resources/countries` | ISO 3166-1 country codes |
| GetVatExemptions | GET | `/api/v1/invoice/resources/vat-exemptions` | VAT exemption reasons |

**All require headers:** `x-api-key`, `x-api-secret`
**All have XML variants** with `Accept: application/xml`

---

## 4. Invoice Operations

### POST ValidateIRN

```
POST {base_url}/api/v1/invoice/validate-irn
```

Validates an Invoice Reference Number.

### POST ValidateInvoice

```
POST {base_url}/api/v1/invoice/validate
```

Validates invoice content against the schema (see 01-invoice-schema.md for full field reference).

### POST SignInvoice

```
POST {base_url}/api/v1/invoice/sign
```

Signs a validated invoice with ECDSA digital signature and CSID.

### GET DownloadInvoice

```
GET {base_url}/api/v1/invoice/download/{invoice_id}
```

Downloads a signed invoice.

### PATCH UpdateInvoice

```
PATCH {base_url}/api/v1/invoice/{invoice_id}
```

Updates an existing invoice.

### GET ConfirmInvoice

```
GET {base_url}/api/v1/invoice/confirm/{invoice_id}
```

Confirms/acknowledges receipt of an invoice.

### GET SearchInvoice

```
GET {base_url}/api/v1/invoice/search?{params}
```

Searches for invoices with pagination and filtering.

**All have XML variants.**

---

## 5. Transmitting

Endpoints for transmitting invoices between parties and looking up transmitted invoices.

### GET LookupWithIRN

```
GET {base_url}/api/v1/transmit/lookup/irn/{irn}
```

Look up a transmitted invoice by its IRN.

### GET LookupWithTIN

```
GET {base_url}/api/v1/transmit/lookup/tin/{tin}
```

Look up transmitted invoices by TIN.

### POST Transmit

```
POST {base_url}/api/v1/transmit
```

Transmit a signed invoice to the buyer/FIRS.

### GET HealthCheck

```
GET {base_url}/api/v1/health
```

Check API availability.

**XML variants available for Transmit and Lookup endpoints.**

---

## Integration Flow for Baci

Based on these endpoints, the invoice submission flow would be:

```
1. TaxpayerLogin          → Get auth token
2. ValidateInvoice        → Validate invoice data against schema
3. SignInvoice            → Get digital signature + CSID
4. Transmit              → Send signed invoice to FIRS/buyer
5. (Optional) SearchInvoice → Query submitted invoices
6. (Optional) ConfirmInvoice → Buyer confirms receipt
```

### One-time setup flow:
```
1. TaxpayerLogin          → Authenticate merchant
2. GetEntity              → Verify merchant's FIRS entity
3. GetTaxCategories       → Cache tax categories
4. GetPaymentMeans        → Cache payment method codes
5. GetInvoiceTypes        → Cache invoice type codes
6. GetProductCodes        → Cache HSN/product codes
```

---

## Baci Implementation Notes

### API Keys
- `x-api-key` and `x-api-secret` — obtained during SI onboarding with FIRS
- Store in environment variables: `FIRS_API_KEY`, `FIRS_API_SECRET`

### Per-Merchant Credentials
- Each merchant needs `TAXPAYER_EMAIL` and `TAXPAYER_PASSWORD` for their FIRS account
- Store encrypted in `merchants` table: `firs_email`, `firs_password_encrypted`
- Or use OAuth token storage if FIRS provides long-lived tokens

### Caching Strategy
- Resource endpoints (countries, currencies, tax categories, payment means, invoice types, product codes) — cache locally, refresh daily
- Store in Supabase table `firs_reference_data` or in-memory cache

### Error Handling
- Validate locally first (Zod schema matching FIRS requirements)
- Then call ValidateInvoice for FIRS-side validation
- Handle validation errors and surface to merchant dashboard
