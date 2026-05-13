#!/bin/bash
# Stop hook: Quality gate — blocks Claude from stopping until lint + typecheck + tests pass
# Uses JSON decision control so Claude gets structured context to fix errors
#
# How it works:
#   exit 0 + no JSON      = allow stop (all checks passed)
#   exit 0 + JSON block   = prevent stop, Claude continues with reason as context
#   stop_hook_active check = prevents infinite retry loops

INPUT=$(cat)

# CRITICAL: Prevent infinite loops — if Claude is already fixing from a prior block, let it stop
if echo "$INPUT" | jq -e '.stop_hook_active == true' >/dev/null 2>&1; then
  exit 0
fi

# Resolve the active worktree. `$CLAUDE_PROJECT_DIR` is just where the
# session started — not necessarily where the current task lives. Sessions
# routinely spawn isolated worktrees for PR work, and auditing the session
# root surfaces accumulated WIP from other tasks every time the hook fires.
#
# Pick the worktree whose .git/index was most recently modified. Every
# `git add` updates the index, so the active worktree's index is newest
# while idle worktrees stay frozen at their last-touched mtime.
#
# Falls back to $CLAUDE_PROJECT_DIR if `git worktree list` fails or no
# index files are found.
ACTIVE_DIR="$CLAUDE_PROJECT_DIR"
if command -v git >/dev/null 2>&1; then
  newest_mtime=0
  newest_path=""
  while IFS= read -r wt; do
    [ -z "$wt" ] && continue
    # Linked worktrees have .git as a FILE pointing to the real gitdir
    # under <main>/.git/worktrees/<name>. The main worktree has .git as a
    # directory. The index lives at <gitdir>/index in both cases.
    if [ -f "$wt/.git" ]; then
      gitdir=$(awk '/^gitdir:/{print $2; exit}' "$wt/.git")
    else
      gitdir="$wt/.git"
    fi
    idx="$gitdir/index"
    [ -f "$idx" ] || continue
    # macOS uses `stat -f %m`, GNU/Linux uses `stat -c %Y`. Try both.
    mtime=$(stat -f %m "$idx" 2>/dev/null || stat -c %Y "$idx" 2>/dev/null)
    [ -z "$mtime" ] && continue
    if [ "$mtime" -gt "$newest_mtime" ]; then
      newest_mtime=$mtime
      newest_path="$wt"
    fi
  done < <(git -C "$CLAUDE_PROJECT_DIR" worktree list --porcelain 2>/dev/null | awk '/^worktree /{print $2}')
  [ -n "$newest_path" ] && ACTIVE_DIR="$newest_path"
fi

cd "$ACTIVE_DIR" || exit 0

# Check that new/modified source files have colocated test files
# Exempt: types, config, index barrels, test files, route files, CSS, non-code files
#
# Scope: staged + untracked only (NOT unstaged). The session-end hook should
# audit files actually about to ship, not accumulated WIP. Auditing the full
# working tree against HEAD fires every session against any uncommitted work,
# even when the current task touches none of it.
MISSING_TESTS=""
for FILE in $(git diff --name-only --cached --diff-filter=ACM 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null); do
  # Strip trailing whitespace/CR from git output
  FILE=$(echo "$FILE" | tr -d '\r' | xargs)
  [ -z "$FILE" ] && continue
  # Only check .ts/.tsx files in source directories
  case "$FILE" in
    apps/*/src/**/*.ts|apps/*/src/**/*.tsx|packages/*/src/**/*.ts|packages/*/src/**/*.tsx) ;;
    *) continue ;;
  esac
  # Skip files that don't need tests
  BASENAME=$(basename "$FILE")
  case "$BASENAME" in
    *.test.ts|*.test.tsx|*.spec.ts|*.spec.tsx) continue ;;  # Already a test
    *.d.ts) continue ;;                                      # Declaration files
    index.ts|index.tsx) continue ;;                          # Barrel re-exports
    page.tsx|layout.tsx|loading.tsx|error.tsx) continue ;;   # Next.js route files
    not-found.tsx|template.tsx|default.tsx) continue ;;      # Next.js route files
    global-error.tsx|route.ts) continue ;;                   # Next.js route/error files
    globals.css|*.css) continue ;;                           # Style files
  esac
  case "$FILE" in
    */types/*|*/types.ts|*/types.tsx) continue ;;            # Type-only files
    */config/*|*/constants/*) continue ;;                    # Config/constants
    */ui/*) continue ;;                                      # shadcn base components
    */contexts/*) continue ;;                                # React context providers
    */templates/*) continue ;;                               # Store templates
  esac
  # Derive expected test file path using bash parameter expansion
  DIR=$(dirname "$FILE")
  EXT="${BASENAME##*.}"
  BASE="${BASENAME%.*}"
  TEST_FILE="$DIR/$BASE.test.$EXT"
  if [ ! -f "$TEST_FILE" ]; then
    MISSING_TESTS="$MISSING_TESTS\n  - $FILE (expected: $TEST_FILE)"
  fi
done

if [ -n "$MISSING_TESTS" ]; then
  jq -n --arg reason "Missing test files for new/modified source files. Create colocated tests:\n$MISSING_TESTS\n\nSee .ruler/07-testing.md for test requirements." \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# Run Biome lint check (~2-5s)
LINT_RESULT=$(pnpm turbo lint 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  TRIMMED=$(echo "$LINT_RESULT" | tail -30)
  jq -n --arg reason "Lint errors detected. Fix all lint errors before completing:\n\n$TRIMMED" \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# Run TypeScript type check (~10-30s)
TYPE_RESULT=$(pnpm turbo typecheck 2>&1)
TYPE_EXIT=$?

if [ $TYPE_EXIT -ne 0 ]; then
  TRIMMED=$(echo "$TYPE_RESULT" | tail -30)
  jq -n --arg reason "TypeScript errors detected. Fix all type errors before completing:\n\n$TRIMMED" \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# Run tests (~5-30s)
TEST_RESULT=$(pnpm turbo test 2>&1)
TEST_EXIT=$?

if [ $TEST_EXIT -ne 0 ]; then
  TRIMMED=$(echo "$TEST_RESULT" | tail -30)
  jq -n --arg reason "Tests failed. Fix all failing tests before completing:\n\n$TRIMMED" \
    '{"decision": "block", "reason": $reason}'
  exit 0
fi

# Run CodeRabbit AI code review on uncommitted changes (~5-15s)
# Fail-open: if CodeRabbit itself crashes (OOM, network, auth), let the stop proceed.
# Only block when CodeRabbit actually reports code issues (exit 0 with findings).
if command -v coderabbit >/dev/null 2>&1; then
  CR_RESULT=$(coderabbit review --prompt-only -t uncommitted 2>&1) || true

  # Skip if CodeRabbit errored out (OOM, network failure, auth issues)
  if echo "$CR_RESULT" | grep -qiE "(REVIEW ERROR|Out of memory|Failed to start|network|unauthorized|ECONNREFUSED)"; then
    : # CodeRabbit crashed — fail-open, allow stop
  elif [ -n "$CR_RESULT" ] && echo "$CR_RESULT" | grep -qiE "(critical|high|error|warning|issue)"; then
    TRIMMED=$(echo "$CR_RESULT" | tail -30)
    jq -n --arg reason "CodeRabbit found issues in your changes. Review and fix:\n\n$TRIMMED" \
      '{"decision": "block", "reason": $reason}'
    exit 0
  fi
fi

# All checks pass — allow Claude to stop
exit 0
