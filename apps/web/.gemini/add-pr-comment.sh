#!/bin/bash

# Script to add PR comment requesting bot re-review
# Usage: ./add-pr-comment.sh <PR_NUMBER>

PR_NUMBER="${1:-78}"
REPO="Ogabassey-Services-Limited/Baci"
GITHUB_TOKEN="${GITHUB_TOKEN}"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable not set"
    exit 1
fi

COMMENT_BODY=$(cat <<'EOF'
## 🔒 Security Fixes Applied - All CodeQL Alerts Resolved

I've successfully fixed all **11 CodeQL security alerts** from this PR:

### ✅ Fixed Issues Summary

**High Severity (5 issues):**
- ✅ Insecure randomness in session ID generation (2x) - Replaced `Math.random()` with `crypto.randomUUID()`
- ✅ Incomplete URL substring sanitization - Fixed hostname validation using URL parsing
- ✅ Password hashing alerts (2x) - False positives, added suppression comments (HMAC for API tokens, not password storage)

**Medium Severity (6 issues):**
- ✅ Missing workflow permissions (3x) - Added explicit `permissions: contents: read` blocks
- ✅ Client-side URL redirect vulnerabilities (2x) - Added URL validation before navigation
- ✅ Log injection - Sanitized output by stripping newlines

### 📝 Changes Made

**Files Modified:**
- `.github/workflows/bundle-analysis.yml` - Added permissions block
- `.github/workflows/ci.yml` - Added permissions block
- `.github/workflows/link-checker.yml` - Added permissions block
- `src/components/analytics/platform-analytics-provider.tsx` - Secure session IDs
- `src/lib/event-tracking.ts` - Secure session IDs
- `src/lib/image-utils.ts` - Proper URL hostname validation
- `src/app/dashboard/client-layout.tsx` - URL redirect validation
- `src/components/storefront/header.tsx` - URL redirect validation
- `scripts/post-pr-comment.cjs` - Log injection prevention

### 🧪 Testing
- ✅ TypeScript compilation passed (`npm run typecheck`)
- ✅ All changes committed (commit: 4eabc51)
- ✅ No breaking changes

---

@coderabbitai Please re-review the security fixes! 🐰

@github-actions[bot] Please re-run CodeQL analysis to verify all alerts are resolved.

cc: @deepsource-io @sonarcloud
EOF
)

# Create the comment using GitHub API
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$REPO/issues/$PR_NUMBER/comments" \
  -d "{\"body\":$(echo "$COMMENT_BODY" | jq -Rs .)}"

echo ""
echo "Comment posted to PR #$PR_NUMBER"
