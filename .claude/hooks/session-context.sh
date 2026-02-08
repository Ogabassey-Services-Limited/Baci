#!/bin/bash
# SessionStart hook: Injects project context at session start
cd "$CLAUDE_PROJECT_DIR" || exit 0

echo "=== Git Status ==="
git status --short 2>/dev/null | head -20

echo ""
echo "=== Current Branch ==="
git branch --show-current 2>/dev/null

echo ""
echo "=== Recent Commits ==="
git log --oneline -5 2>/dev/null

echo ""
echo "=== Project Reminders ==="
echo "- pnpm monorepo with Turborepo (pnpm turbo <command>)"
echo "- Biome for linting and formatting (not ESLint/Prettier)"
echo "- Supabase for database; migrations in supabase/migrations/"
echo "- Path alias: @/* maps to ./src/*"
echo "- React 19 + Next.js 16 App Router"
echo "- TypeScript strict mode"
echo "- React Compiler enabled (no manual memo/useCallback)"

exit 0
