
# PATCH SCRIPT to update publisher.py
import re

with open("/home/bassey/ogabassey-agents/app/publisher.py", "r") as f:
    content = f.read()

# Make sure function signature is correct (handled by previous sed tool, but good valid)
if "featured_image_url=None" not in content:
   content = content.replace('def publish_to_blog(title, content, tags, category, status="draft"):', 'def publish_to_blog(title, content, tags, category, status="draft", featured_image_url=None):')

# Update the SQL payload dict construction
if '"featured_image_url": featured_image_url' not in content:
    # Look for the payload construction part
    pattern = r'payload = \{\s+"merchant_id": merchant_id,\s+"title": title,\s+"slug": slug,\s+"content": content,\s+"tags": tags,\s+"category": category,\s+"status": status,\s+"author_name": "Antigravity Agent",\s+"published_at": datetime.datetime.now\(\).isoformat\(\)\s+\}'
    
    replacement = 'payload = {\n        "merchant_id": merchant_id,\n        "title": title,\n        "slug": slug,\n        "content": content,\n        "tags": tags,\n        "category": category,\n        "status": status,\n        "author_name": "Antigravity Agent",\n        "published_at": datetime.datetime.now().isoformat(),\n        "featured_image_url": featured_image_url\n    }'
    
    # Simple regex replace might be brittle, let's just use string replace if exact match
    # Or simpler: inject it before '}'
    content = content.replace('"author_name": "Antigravity Agent",', '"author_name": "Antigravity Agent",\n        "featured_image_url": featured_image_url,')

with open("/home/bassey/ogabassey-agents/app/publisher.py", "w") as f:
    f.write(content)
print("Updated publisher.py")
