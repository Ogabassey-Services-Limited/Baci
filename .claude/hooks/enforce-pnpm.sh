#!/bin/bash
# PreToolUse hook: Rewrites npm/yarn commands to pnpm
# Matcher: Bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

# Rewrite npm/yarn to pnpm
if echo "$COMMAND" | grep -qE "^(npm |yarn )"; then
  NEW_COMMAND=$(echo "$COMMAND" | sed -E 's/^(npm|yarn) /pnpm /')
  jq -n --arg cmd "$NEW_COMMAND" --arg reason "This is a pnpm monorepo. Rewritten to pnpm." '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "allow",
      "permissionDecisionReason": $reason,
      "updatedInput": { "command": $cmd }
    }
  }'
  exit 0
fi

# Block bare `git push` without branch specification
if echo "$COMMAND" | grep -qE "^git push$"; then
  jq -n '{
    "hookSpecificOutput": {
      "hookEventName": "PreToolUse",
      "permissionDecision": "deny",
      "permissionDecisionReason": "Always specify remote and branch: git push origin <branch-name>"
    }
  }'
  exit 0
fi

exit 0
