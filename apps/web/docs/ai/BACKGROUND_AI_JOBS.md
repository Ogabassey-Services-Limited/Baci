# Background AI Jobs Implementation

## Overview
Successfully implemented asynchronous background job processing for AI operations to address the scalability issue of synchronous AI calls that could cause serverless function timeouts.

## Problem Solved
**Before**: AI operations like `processPriceList` were executed synchronously using `await model.generateContent()`, which:
- Blocked the serverless function for the entire duration
- Could timeout on Vercel (10-60s limit)
- Blocked the UI, creating poor UX
- Couldn't handle long-running AI tasks

**After**: AI operations are queued as jobs and processed asynchronously by a background worker, which:
- Returns immediately to the user
- Processes jobs in the background
- Allows UI to show progress
- Handles long-running tasks gracefully

## Architecture

### Components

1. **`ai_jobs` Table** (Database)
   - Stores job metadata and status
   - Fields: id, merchant_id, type, status, input, output, error, timestamps
   - Statuses: `pending` → `processing` → `completed`/`failed`

2. **Job Creation API** (`/api/ai-jobs`)
   - `POST`: Creates a new AI job
   - `GET`: Lists jobs for the merchant
   - Returns job ID immediately

3. **Job Status API** (`/api/ai-jobs/[id]`)
   - `GET`: Fetches a specific job's status and result
   - Used for polling

4. **Background Worker** (`/api/ai-jobs/worker`)
   - `POST`: Processes pending jobs (triggered by cron)
   - Fetches up to 5 pending jobs at a time
   - Updates job status as it processes
   - Stores results in the `output` field

5. **Cron Job** (`vercel.json`)
   - Runs every 2 minutes
   - Triggers the worker endpoint
   - Ensures jobs are processed regularly

## Data Flow

```
User submits price list
       ↓
Create AI job (POST /api/ai-jobs)
       ↓
Job stored with status='pending'
       ↓
Return job ID to client
       ↓
Client polls job status (GET /api/ai-jobs/[id])
       ↓
Cron triggers worker every 2 min
       ↓
Worker picks up pending jobs
       ↓
Worker processes with Gemini AI
       ↓
Worker updates job status to 'completed'
       ↓
Client receives result on next poll
       ↓
Display results to user
```

## Code Changes

### 1. Database Migration
**File**: `supabase/migrations/20251120162700_create_ai_jobs.sql`
- Created `ai_jobs` table
- Added indexes for performance
- Configured RLS policies

### 2. API Endpoints
**Files**:
- `src/app/api/ai-jobs/route.ts` - Create and list jobs
- `src/app/api/ai-jobs/[id]/route.ts` - Get job status
- `src/app/api/ai-jobs/worker/route.ts` - Process jobs

### 3. Frontend Changes
**File**: `src/app/dashboard/products/page.tsx`
- Replaced direct `processPriceList()` call with job creation
- Added polling logic to check job status every 2 seconds
- Added timeout handling (60 seconds)
- Improved error handling and user feedback

### 4. Configuration
**File**: `vercel.json`
- Added cron job configuration
- Runs worker every 2 minutes

## Job Types

Currently supported:
- `price_list_processing`: Analyzes price lists and suggests product changes

Easily extensible for:
- `product_description_generation`
- `image_enhancement`
- `bulk_product_updates`
- Any other AI-powered task

## Polling Strategy

**Client-side polling**:
- Polls every 2 seconds
- Timeout after 60 seconds
- Clears interval on completion or failure

**Why polling instead of WebSockets?**
- Simpler implementation
- Works with serverless architecture
- No persistent connections needed
- Sufficient for this use case (jobs complete in <30s typically)

## Security

1. **Authentication**:
   - Job creation requires authenticated user
   - RLS policies ensure users only see their own jobs

2. **Worker Authorization**:
   - Worker endpoint requires `AI_WORKER_SECRET` token
   - Prevents unauthorized job processing

3. **Service Role**:
   - Worker uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
   - Necessary for processing jobs from all merchants

## Performance Considerations

### Batch Processing
- Worker processes up to 5 jobs per run
- Prevents timeout on worker endpoint
- Ensures fair distribution of resources

### Database Queries
- Indexed on `merchant_id`, `status`, and `created_at`
- Efficient job lookup and filtering

### Cron Frequency
- Every 2 minutes balances responsiveness and cost
- Can be adjusted based on load

## Error Handling

### Job Failures
- Errors are caught and stored in `error` field
- Job status set to `failed`
- User sees error message via toast notification

### Worker Failures
- Individual job failures don't stop worker
- Worker continues processing remaining jobs
- Failed jobs can be retried manually

### Timeout Handling
- Client timeout after 60 seconds
- User notified to check back later
- Job continues processing in background

## Monitoring & Debugging

### Check Job Status
```sql
SELECT * FROM ai_jobs 
WHERE merchant_id = 'your-merchant-id' 
ORDER BY created_at DESC;
```

### View Failed Jobs
```sql
SELECT * FROM ai_jobs 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Manually Trigger Worker
```bash
curl -X POST https://your-app.vercel.app/api/ai-jobs/worker \
  -H "Authorization: Bearer your_ai_worker_secret"
```

## Future Improvements

1. **Real-time Updates**:
   - Replace polling with Supabase Realtime subscriptions
   - Instant updates when job completes

2. **Job Priority**:
   - Add priority field to process urgent jobs first
   - Implement priority queue

3. **Retry Logic**:
   - Automatic retry for failed jobs
   - Exponential backoff

4. **Job History**:
   - Archive completed jobs after 30 days
   - Separate table for historical data

5. **Progress Updates**:
   - Stream progress for long-running jobs
   - Show percentage complete

6. **Worker Scaling**:
   - Multiple worker instances for high load
   - Distributed job processing

7. **Rate Limiting**:
   - Limit jobs per merchant per hour
   - Prevent abuse

## Migration Guide

### For Existing Code
1. Replace synchronous AI calls with job creation
2. Add polling logic for job completion
3. Update UI to show processing state

### Example Migration
**Before**:
```typescript
const result = await processPriceList(products, data, vendor, type);
setAiResponse(result);
```

**After**:
```typescript
// Create job
const response = await fetch('/api/ai-jobs', {
  method: 'POST',
  body: JSON.stringify({
    type: 'price_list_processing',
    input: { products, data, vendor, type }
  })
});
const { job } = await response.json();

// Poll for completion
const interval = setInterval(async () => {
  const { job: updated } = await fetch(`/api/ai-jobs/${job.id}`).then(r => r.json());
  if (updated.status === 'completed') {
    clearInterval(interval);
    setAiResponse(updated.output);
  }
}, 2000);
```

## Environment Variables

See `AI_WORKER_ENV.md` for required environment variables.

## Related Files
- `/supabase/migrations/20251120162700_create_ai_jobs.sql`
- `/src/app/api/ai-jobs/route.ts`
- `/src/app/api/ai-jobs/[id]/route.ts`
- `/src/app/api/ai-jobs/worker/route.ts`
- `/src/app/dashboard/products/page.tsx`
- `/vercel.json`
- `/AI_WORKER_ENV.md`

## Testing

### Local Testing
1. Start the dev server: `pnpm --filter @baci/web dev`
2. Manually trigger worker: 
   ```bash
   curl -X POST http://localhost:3000/api/ai-jobs/worker \
     -H "Authorization: Bearer dev-secret-token"
   ```
3. Submit a price list in the UI
4. Watch job status in database

### Production Testing
1. Deploy to Vercel
2. Verify cron job is configured
3. Submit a test price list
4. Monitor job processing in Supabase dashboard

## Benefits

### Scalability
✅ No serverless function timeouts
✅ Can handle long-running AI tasks
✅ Processes jobs in background
✅ Scales with cron frequency

### User Experience
✅ Immediate feedback (job created)
✅ Non-blocking UI
✅ Progress indication
✅ Better error handling

### Reliability
✅ Jobs persist in database
✅ Can retry failed jobs
✅ Audit trail of all AI operations
✅ Graceful degradation

### Cost Efficiency
✅ Efficient use of serverless resources
✅ Batch processing reduces overhead
✅ No wasted compute on polling
