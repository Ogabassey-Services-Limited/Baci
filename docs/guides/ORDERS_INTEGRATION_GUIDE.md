# Orders Integration Guide

## Overview
I've successfully connected the storefront checkout to the merchant dashboard so that orders placed by customers on the storefront will appear in the merchant's dashboard in real-time.

## What Was Implemented

### 1. Database Schema Enhancement
**File:** `supabase-orders-update.sql`

Added the following fields to the `orders` table:
- `order_number` - Auto-generated order numbers (e.g., #06001, #06002)
- `payment_status` - Payment status tracking
- `shipping_status` - Shipping status tracking
- `source` - Order source (online_store, whatsapp, instagram, etc.)
- `shipping_fee` - Shipping cost
- `total` - Total order amount
- `payment_method` - Payment method used
- `customer_phone` - Customer phone number
- `notes` - Optional order notes

The schema includes auto-generation of order numbers via database triggers.

### 2. API Endpoints
**Location:** `src/app/api/orders/`

#### POST /api/orders
- Creates new orders from the storefront
- Automatically creates or links customer records
- Validates required fields
- Returns the created order with generated order number

#### GET /api/orders
- Fetches all orders for the authenticated merchant
- Supports filtering by payment_status, shipping_status, and search
- Returns orders sorted by creation date (newest first)

#### PATCH /api/orders/[id]
- Updates order status (payment or shipping)
- Validates merchant ownership
- Only allows updating specific fields (payment_status, shipping_status, notes, shipping_address)

### 3. Storefront Checkout Integration
**File:** `src/app/checkout/page.tsx`

Updated the checkout flow to:
1. Get the merchant ID from the merchant context
2. Prepare order data with cart items and shipping information
3. Send order to the API endpoint
4. Display the generated order number on success
5. Handle errors gracefully with user feedback

### 4. Success Page Enhancement
**File:** `src/app/checkout/success/page.tsx`

Updated to display:
- Order number (e.g., "Order #06001")
- Complete order details from the database
- Correct totals including shipping fees

### 5. Dashboard Orders Page Integration
**File:** `src/app/dashboard/orders/page.tsx`

Enhanced the dashboard to:
1. Fetch real orders from the API instead of mock data
2. Auto-refresh when filters change
3. Update orders via API when status changes
4. Display loading states and error handling
5. Maintain fallback to mock data if API fails

## Setup Instructions

### Step 1: Run Database Migration

You need to run the SQL migrations in your Supabase database:

1. **First, ensure the base schema is applied** (if not already done):
   ```bash
   # Copy the contents of supabase-schema.sql and run it in Supabase SQL Editor
   ```

2. **Apply the orders update**:
   ```bash
   # Copy the contents of supabase-orders-update.sql and run it in Supabase SQL Editor
   ```

   Or you can run this command in the Supabase SQL Editor:
   ```sql
   -- Copy and paste all contents from supabase-orders-update.sql
   ```

### Step 2: Verify Environment Variables

Ensure your `.env.local` file has the Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Step 3: Rebuild and Restart

```bash
pnpm turbo build
pnpm turbo dev
```

## Testing the Integration

### 1. Test Order Creation (Storefront → Dashboard)

1. **Go to the storefront** (homepage)
2. **Add products to cart**
3. **Go to checkout** (`/checkout`)
4. **Complete the checkout flow:**
   - Step 1: Sign in or create an account
   - Step 2: Fill in shipping information
   - Step 3: Complete payment (demo)
5. **Verify success page** shows order number (e.g., "#06001")
6. **Go to dashboard** (`/dashboard/orders`)
7. **Verify the order appears** in the orders list with:
   - Correct order number
   - Customer name
   - Total amount
   - Payment status: "Paid"
   - Shipping status: "Pending"
   - Source: "other" (for online store)

### 2. Test Order Status Updates (Dashboard → Database)

1. **Go to dashboard orders** (`/dashboard/orders`)
2. **Click on an order's shipping status dropdown**
3. **Update the status** (e.g., Pending → Processing → Shipped)
4. **Verify toast notification** appears
5. **Refresh the page** to ensure the status persists

### 3. Test Filtering and Search

1. **Use the filter dropdowns** to filter by:
   - Payment status
   - Shipping status
2. **Use the search bar** to search by:
   - Customer name
   - Order number
3. **Verify orders are filtered correctly**

## Data Flow

```
Customer (Storefront)
    ↓
Add to Cart → localStorage
    ↓
Checkout → Fill Shipping Info
    ↓
POST /api/orders
    ↓
Supabase Database (orders table)
    ↓
Auto-generate order_number
    ↓
Create/Link customer record
    ↓
Return order data
    ↓
Show Success Page with Order #
    ↓

Merchant (Dashboard)
    ↓
GET /api/orders
    ↓
Display orders list
    ↓
Update Status → PATCH /api/orders/[id]
    ↓
Database updated
    ↓
UI refreshed
```

## Key Features

✅ **Real-time order creation** - Orders appear immediately in dashboard
✅ **Auto-generated order numbers** - Sequential order IDs (e.g., #06001, #06002)
✅ **Customer tracking** - Automatic customer creation and linking
✅ **Status management** - Update payment and shipping status from dashboard
✅ **Search and filtering** - Find orders by customer name, order number, or status
✅ **Error handling** - Graceful fallbacks and user-friendly error messages
✅ **Type safety** - Full TypeScript support throughout
✅ **Multi-tenant** - Each merchant sees only their own orders

## Database Tables Structure

### Orders Table
```sql
orders (
  id UUID PRIMARY KEY,
  merchant_id UUID,           -- Links to merchant
  customer_id UUID,           -- Links to customer
  order_number TEXT UNIQUE,   -- Auto-generated (e.g., #06001)
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  items JSONB,                -- [{product_id, name, price, quantity, image}]
  subtotal DECIMAL,
  shipping_fee DECIMAL,
  total DECIMAL,
  payment_status TEXT,        -- paid, unpaid, pending, etc.
  payment_method TEXT,        -- card, cash, bank_transfer
  shipping_status TEXT,       -- pending, processing, shipped, etc.
  shipping_address JSONB,     -- {firstName, lastName, address, city, state}
  source TEXT,                -- online_store, whatsapp, instagram, etc.
  notes TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Troubleshooting

### Orders Not Appearing in Dashboard?

1. **Check Supabase connection:**
   - Verify environment variables are correct
   - Check Supabase dashboard for errors

2. **Check browser console:**
   - Look for API errors
   - Check network tab for failed requests

3. **Verify merchant is set up:**
   - Ensure you're logged in as a merchant
   - Check that merchant record exists in database

4. **Check RLS policies:**
   - Ensure Row Level Security policies allow order creation
   - The SQL migration includes the necessary policies

### Status Updates Not Persisting?

1. **Check authentication:**
   - Ensure you're logged in
   - Verify the merchant owns the order

2. **Check API response:**
   - Open browser DevTools → Network tab
   - Look for PATCH request to `/api/orders/[id]`
   - Check for error responses

3. **Verify database permissions:**
   - Ensure RLS policies allow merchants to update their orders

## Next Steps (Optional Enhancements)

- [ ] Add email notifications when orders are placed
- [ ] Add order details page with full item breakdown
- [ ] Add order notes/comments system
- [ ] Add bulk status updates
- [ ] Add order export (CSV/PDF)
- [ ] Add inventory management (reduce stock on order)
- [ ] Add order analytics and reports
- [ ] Add customer order history view
- [ ] Add refund processing
- [ ] Add shipping tracking integration

## Files Modified

1. `supabase-orders-update.sql` - Database schema updates
2. `src/app/api/orders/route.ts` - POST and GET endpoints
3. `src/app/api/orders/[id]/route.ts` - PATCH and GET single order
4. `src/app/checkout/page.tsx` - Order creation on checkout
5. `src/app/checkout/success/page.tsx` - Display order number
6. `src/app/dashboard/orders/page.tsx` - Fetch and manage orders

---

**Status:** ✅ Complete and ready for testing
**Last Updated:** 2025-11-18
