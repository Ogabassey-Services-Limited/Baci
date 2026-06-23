# Google AI API Setup (Optional)

## Current Status

Your app works **without** the Google AI API! It uses fallback color palettes when AI is unavailable.

## What Happens Without API Key:

✅ **App still works!**
- Form submission succeeds
- Fallback color palette is generated based on your preferences
- Logo upload works (if you provide one)
- Data saves to localStorage

❌ **What you lose:**
- AI-generated logos
- AI-optimized brand colors
- Advanced AI features

## To Enable Full AI Features:

### Step 1: Get Google AI API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **"Get API Key"**
3. Create a new project or select existing one
4. Click **"Create API Key"**
5. Copy the API key

### Step 2: Add to Your Project

Create or update `.env.local`:

```bash
GOOGLE_GENAI_API_KEY=your_api_key_here
```

### Step 3: Restart Dev Server

```bash
pnpm --filter @baci/web dev
```

## Testing AI Features

### Without API Key (Current):
- Enter "blue" in favorite color → Get blue palette
- Enter "red" → Get red palette
- Upload logo → Logo is used as-is

### With API Key:
- AI generates custom logo if none uploaded
- AI creates optimized color palette
- Better brand consistency

## Cost

- **Free Tier**: 60 requests per minute
- **Pricing**: Very generous free tier
- **For Demo**: Free tier is more than enough

## Do You Need It?

- **For Demo/Testing**: No, fallback works fine
- **For Production**: Yes, for best UX
- **For Portfolio**: Optional, fallback is good

Your app will work perfectly either way! 🎉
