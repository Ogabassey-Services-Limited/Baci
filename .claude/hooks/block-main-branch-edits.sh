#!/bin/bash
# PreToolUse hook: Prevents file edits on main/master branch
# Matcher: Edit|Write
CURRENT_BRANCH=$(git -C "$CLAUDE_PROJECT_DIR" branch --show-current 2>/dev/null)

if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
  jq -n --arg reason "Cannot edit files on '$CURRENT_BRANCH' branch. Create a feature branch first: git checkout -b feature/your-feature" '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": $reason
    }
  }'
  exit 0
fi

exit 0
