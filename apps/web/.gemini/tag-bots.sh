#!/bin/bash

# Helper script to post PR comment with bot tags
# This script will guide you through the process

echo "🤖 PR Comment Bot Tagger"
echo "========================"
echo ""

# Check if GITHUB_TOKEN is already set
if [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ GITHUB_TOKEN found in environment"
    TOKEN="$GITHUB_TOKEN"
else
    # Try to load from .env.local
    if [ -f .env.local ]; then
        export $(grep -v '^#' .env.local | grep GITHUB_TOKEN | xargs)
    fi
    
    if [ -n "$GITHUB_TOKEN" ]; then
        echo "✅ GITHUB_TOKEN loaded from .env.local"
        TOKEN="$GITHUB_TOKEN"
    else
        echo "⚠️  GITHUB_TOKEN not found"
        echo ""
        echo "Please enter your GitHub Personal Access Token:"
        echo "(You can create one at: https://github.com/settings/tokens)"
        echo ""
        read -s -p "Token: " TOKEN
        echo ""
        echo ""
        
        if [ -z "$TOKEN" ]; then
            echo "❌ No token provided. Exiting."
            exit 1
        fi
        
        # Ask if they want to save it
        read -p "Save token to .env.local? (y/n): " SAVE_TOKEN
        if [ "$SAVE_TOKEN" = "y" ] || [ "$SAVE_TOKEN" = "Y" ]; then
            echo "" >> .env.local
            echo "# GitHub Personal Access Token for API access" >> .env.local
            echo "GITHUB_TOKEN=$TOKEN" >> .env.local
            echo "✅ Token saved to .env.local"
        fi
    fi
fi

echo ""
echo "📝 Posting comment to PR #78..."
echo ""

# Run the Node.js script
GITHUB_TOKEN="$TOKEN" node .gemini/post-pr-comment.cjs 78

exit $?
