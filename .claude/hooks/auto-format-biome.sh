#!/bin/bash
# PostToolUse hook: Auto-formats edited files with Biome
# Matcher: Edit|Write
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only format files Biome handles
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.jsonc|*.css)
    cd "$CLAUDE_PROJECT_DIR" || exit 0
    pnpm biome check --write "$FILE_PATH" 2>/dev/null || true
    ;;
esac

exit 0
