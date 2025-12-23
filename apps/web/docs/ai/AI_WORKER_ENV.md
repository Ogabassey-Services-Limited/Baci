# Environment Variables for Background AI Jobs

Add these environment variables to your `.env.local` file:

## Required for AI Worker

```bash
# Supabase Service Role Key (for bypassing RLS in worker)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# AI Worker Secret (for authenticating cron requests)
AI_WORKER_SECRET=your_random_secret_token_here
```

## How to Get These Values

### SUPABASE_SERVICE_ROLE_KEY
1. Go to your Supabase project dashboard
2. Navigate to Settings > API
3. Copy the `service_role` key (⚠️ Keep this secret!)

### AI_WORKER_SECRET
Generate a random secret token:
```bash
openssl rand -base64 32
```

## Vercel Deployment

When deploying to Vercel, add these environment variables in your project settings:
1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add both variables
3. Make sure they're available for Production, Preview, and Development environments

## Cron Job Setup

The `vercel.json` file configures a cron job that runs every 2 minutes to process pending AI jobs.

For local development, you can manually trigger the worker:
```bash
curl -X POST http://localhost:3000/api/ai-jobs/worker \
  -H "Authorization: Bearer your_ai_worker_secret"
```
