# Testing Guide for Scalability Improvements

## Prerequisites
✅ Dev server running on http://localhost:3000
✅ Supabase project configured
✅ Database migrations applied

## Test 1: Server-Side Pagination for Products

### What We're Testing
- Products are fetched from API (not loaded all at once)
- Pagination controls work
- Filtering works server-side
- Stats are calculated correctly

### Steps

1. **Navigate to Products Page**
   - Go to http://localhost:3000/dashboard/products
   - Login if needed

2. **Check Initial Load**
   - ✅ Page should load quickly (even with many products)
   - ✅ Should see "Total Products" stat showing total count
   - ✅ Should see up to 10 products in the table
   - ✅ Check browser Network tab: Should see `GET /api/products?page=1&limit=10`

3. **Test Pagination**
   - If you have more than 10 products:
     - ✅ Should see pagination controls at bottom
     - ✅ Click "Next" button
     - ✅ Should see different products (rows 11-20)
     - ✅ Page number should update
     - ✅ Network tab: Should see `GET /api/products?page=2&limit=10`

4. **Test Filtering**
   - Click "Status" dropdown
   - Select "Published"
   - ✅ Should see only published products
   - ✅ Network tab: Should see `GET /api/products?...&status=published`
   
   - Click "Stock" dropdown
   - Select "Out of Stock"
   - ✅ Should see only out-of-stock products
   - ✅ "Out of Stock" stat should match count

5. **Test Search**
   - Type a product name in the search box
   - ✅ Should filter products by name
   - ✅ Network tab: Should see `GET /api/products?...&search=your-query`

6. **Check Stats**
   - ✅ "Total Products" should show total count (not just current page)
   - ✅ "Inventory Value" should show correct sum
   - ✅ "Out of Stock" should show correct count

### Expected Behavior
- **Fast Loading**: Page loads in <1 second even with 1000+ products
- **Smooth Pagination**: Clicking next/previous is instant
- **Accurate Stats**: Stats reflect entire catalog, not just current page

### Debugging
If products don't load:
```bash
# Check API endpoint
curl http://localhost:3000/api/products

# Check Supabase connection
# Go to Supabase dashboard > Table Editor > products
```

---

## Test 2: Background AI Jobs

### What We're Testing
- AI jobs are created instead of running synchronously
- Jobs are processed by worker
- Results are displayed when complete
- Polling works correctly

### Steps

1. **Prepare Test Data**
   - Make sure you have at least 2-3 products in your catalog
   - Note their names and prices

2. **Submit a Price List**
   - Go to http://localhost:3000/dashboard/products
   - In the search/command box, paste this multi-line text:
   ```
   Product Name: Ceramic Mug
   Price: $55.00
   SKU: CM-001
   
   Product Name: Desk Lamp
   Price: $85.00
   SKU: DL-002
   ```
   - Press Enter or click the send button

3. **Check Job Creation**
   - ✅ Should immediately show "Processing" view
   - ✅ Should NOT freeze or block
   - ✅ Network tab: Should see `POST /api/ai-jobs`
   - ✅ Should start polling: `GET /api/ai-jobs/[job-id]` every 2 seconds

4. **Manually Trigger Worker** (since cron won't run locally)
   Open a new terminal and run:
   ```bash
   curl -X POST http://localhost:3000/api/ai-jobs/worker \
     -H "Authorization: Bearer dev-secret-token"
   ```
   
   Expected response:
   ```json
   {
     "message": "Processed 1 jobs",
     "processed": 1,
     "results": [{"id": "...", "status": "completed"}]
   }
   ```

5. **Check Job Completion**
   - ✅ Within 2-4 seconds, should see "Review Changes" screen
   - ✅ Should show AI-suggested changes
   - ✅ Changes should include price updates for matching products

6. **Verify in Database**
   Go to Supabase dashboard:
   - Table: `ai_jobs`
   - ✅ Should see your job with `status = 'completed'`
   - ✅ `output` field should contain AI response
   - ✅ `completed_at` should be set

### Expected Behavior
- **Immediate Response**: Job creation returns in <500ms
- **Non-Blocking UI**: Can navigate away while processing
- **Automatic Completion**: Results appear when worker processes job
- **Error Handling**: If worker fails, shows error message

### Testing Error Cases

**Test Timeout**:
1. Submit a price list
2. Don't run the worker
3. Wait 60 seconds
4. ✅ Should show timeout message
5. ✅ Job should still be in database as 'pending'

**Test Worker Error**:
1. Submit invalid data (e.g., just random text)
2. Run worker
3. ✅ Should mark job as 'failed'
4. ✅ Should show error message to user

### Debugging

**If job stays "pending"**:
```bash
# Check if job was created
curl http://localhost:3000/api/ai-jobs

# Manually trigger worker
curl -X POST http://localhost:3000/api/ai-jobs/worker \
  -H "Authorization: Bearer dev-secret-token"

# Check Supabase ai_jobs table
```

**If worker fails**:
```bash
# Check worker logs
# Look for errors in terminal running dev server

# Check job error in database
# ai_jobs table > error column
```

**If polling doesn't work**:
- Check browser console for errors
- Verify job ID is correct
- Check Network tab for polling requests

---

## Test 3: Order Items Normalization

### What We're Testing
- New orders insert into `order_items` table
- Order fetching includes items
- Can query order items efficiently

### Steps

1. **Create a Test Order**
   - Go to http://localhost:3000/dashboard/orders/create
   - Fill in customer details
   - Add 2-3 products
   - Submit order

2. **Check Database**
   Go to Supabase dashboard:
   
   **orders table**:
   - ✅ Should see new order
   - ✅ Should NOT have `items` column (or it's empty)
   
   **order_items table**:
   - ✅ Should see 2-3 rows (one per product)
   - ✅ Each row should have `order_id`, `product_id`, `name`, `quantity`, `price`

3. **Fetch Order**
   - Go to http://localhost:3000/dashboard/orders
   - ✅ Should see your order in the list
   - Click on the order
   - ✅ Should see order details with all items

4. **Test Analytics Query**
   In Supabase SQL Editor, run:
   ```sql
   -- Top selling products
   SELECT 
     p.name,
     SUM(oi.quantity) as total_sold,
     SUM(oi.quantity * oi.price) as total_revenue
   FROM order_items oi
   JOIN products p ON oi.product_id = p.id
   GROUP BY p.id, p.name
   ORDER BY total_sold DESC
   LIMIT 10;
   ```
   
   ✅ Should return results (if you have orders)

### Expected Behavior
- **Normalized Data**: Items stored in separate table
- **Efficient Queries**: Can easily analyze sales data
- **Backward Compatible**: Order fetching still works

---

## Performance Benchmarks

### Before Improvements
- Products page load: ~3-5 seconds (with 100 products)
- AI processing: Blocks for 10-30 seconds
- Order analytics: Slow JSONB queries

### After Improvements (Expected)
- Products page load: <1 second (even with 1000 products)
- AI processing: Returns immediately, processes in background
- Order analytics: Fast indexed queries

---

## Common Issues & Solutions

### Issue: "Unauthorized" errors
**Solution**: Make sure you're logged in and have a merchant account

### Issue: Products not loading
**Solution**: 
1. Check Supabase connection
2. Verify migrations are applied
3. Check browser console for errors

### Issue: AI worker not processing jobs
**Solution**:
1. Verify `GEMINI_API_KEY` is set
2. Verify `SUPABASE_SERVICE_ROLE_KEY` is set
3. Check worker endpoint manually
4. Look for errors in terminal

### Issue: Pagination not showing
**Solution**: You need more than 10 products. Add some test products first.

---

## Success Criteria

✅ **Server-Side Pagination**
- [ ] Products load in <1 second
- [ ] Pagination controls work
- [ ] Filtering works server-side
- [ ] Stats are accurate

✅ **Background AI Jobs**
- [ ] Job created immediately
- [ ] UI doesn't freeze
- [ ] Worker processes job
- [ ] Results displayed correctly

✅ **Order Items**
- [ ] Orders create items in separate table
- [ ] Order fetching includes items
- [ ] Analytics queries work

---

## Next Steps After Testing

1. **If all tests pass**: Ready to deploy to production
2. **If issues found**: Debug and fix before deploying
3. **Production deployment**: 
   - Add environment variables to Vercel
   - Deploy
   - Verify cron job is configured
   - Monitor for errors

---

## Monitoring in Production

Once deployed, monitor:
- Vercel logs for errors
- Supabase dashboard for slow queries
- AI jobs table for failed jobs
- User feedback on performance
