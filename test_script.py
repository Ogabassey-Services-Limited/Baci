import re
import os

def find_missing_aria_labels():
    results = []
    # Only search in tsx files in apps/web/src
    for root, _, files in os.walk('apps/web/src'):
        for file in files:
            if not file.endswith('.tsx'): continue

            filepath = os.path.join(root, file)
            with open(filepath, 'r') as f:
                content = f.read()

            # Find all <Button> and <ThemedButton> tags with size="icon"
            pattern = re.compile(r'<(?:Themed)?Button[^>]*size=[\'"]icon[\'"][^>]*>', re.DOTALL)

            for match in pattern.finditer(content):
                button_tag = match.group(0)
                if 'aria-label' not in button_tag:
                    results.append(f"{filepath}: {button_tag.strip()}")

    return results

print(find_missing_aria_labels())
