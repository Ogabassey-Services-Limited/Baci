import re
import os

def fix_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    # Pattern to find icon buttons without aria-label
    # Using negative lookahead to skip if aria-label is already present
    pattern = re.compile(r'(<Button[^>]*size=[\'"]icon[\'"](?:(?!aria-label).)*?>\s*<(?:[A-Z][a-zA-Z0-9]*|svg)[^>]*>(?:.*?</(?:[A-Z][a-zA-Z0-9]*|svg)>)?\s*</Button>)', re.DOTALL)

    # We won't auto-replace, we'll just show what we found for manual review
    # Auto-replacing aria-labels is tricky because we need context for what the button does

    matches = pattern.findall(content)
    if matches:
        print(f"--- {filepath} ---")
        for match in matches:
            print(match)
            print("-" * 20)

# fix_file('apps/web/src/app/dashboard/client-page.tsx')
