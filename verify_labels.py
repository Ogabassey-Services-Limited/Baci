with open('apps/web/src/app/dashboard/client-page.tsx', 'r') as f:
    content = f.read()

if 'aria-label="View customers"' in content and 'aria-label="View insights"' in content:
    print("Labels added successfully.")
else:
    print("Failed to add labels.")
