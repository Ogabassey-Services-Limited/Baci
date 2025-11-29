#!/bin/bash
echo "🔄 Restarting development server with fresh cache..."

# Kill any running Next.js processes
pkill -f "next dev" 2>/dev/null || true

# Clear Next.js cache
rm -rf .next

# Restart dev server
echo "✅ Cache cleared! Now run: npm run dev"
