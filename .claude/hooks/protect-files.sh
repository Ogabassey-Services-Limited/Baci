#!/bin/bash
# PreToolUse hook: Blocks edits to sensitive/generated files
# Matcher: Edit|Write
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROTECTED_PATTERNS=(
  ".env"
  ".env.local"
  ".env.production"
  ".env.staging"
  ".env.development"
  "pnpm-lock.yaml"
  "package-lock.json"
  "yarn.lock"
  ".git/"
  "node_modules/"
  ".next/"
  ".vercel/"
  ".turbo/"
  "supabase/.temp/"
  ".expo/"
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    jq -n --arg reason "Cannot edit '$FILE_PATH' — matches protected pattern '$pattern'. Use a different approach or ask the user to edit this file manually." '{
      "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": $reason
      }
    }'
    exit 0
  fi
done

exit 0
