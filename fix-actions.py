import os
import re

for root, _, files in os.walk('.github/workflows'):
    for f in files:
        if f.endswith('.yml') or f.endswith('.yaml'):
            path = os.path.join(root, f)
            with open(path, 'r') as file:
                content = file.read()

            # The warning is about pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda (which is v4.1.0)
            # The issue might be that pnpm action setup needs to use node20? Or we are using node24 but pnpm action isn't updated.
            # But the actual failure in deploy-preview seems to be during pnpm install or pnpm dlx vercel. Let's look at the logs again.
