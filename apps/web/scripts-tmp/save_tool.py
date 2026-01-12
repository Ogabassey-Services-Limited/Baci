import os
import re
from datetime import datetime
from supabase import create_client, Client
from google.adk.tools import tool
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Initialize Supabase client
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = None
if url and key:
    try:
        supabase = create_client(url, key)
    except Exception as e:
        print(f"Error initializing Supabase: {e}")

MERCHANT_ID = "6b5cb8a4-5575-456c-b936-8cdfae30db74"

def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    return text[:200]

@tool
def save_draft(title: str, content: str, image_url: str = None) -> str:
    """
    Saves a blog post draft to the database.
    ALWAYS use this tool after generating the blog post content.

    Args:
        title: The title of the blog post.
        content: The full markdown content of the blog post.
        image_url: Optional URL for the featured image (ensure it is a valid URL).
    """
    if not supabase:
        return "Error: Database connection not configured (check .env)."

    try:
        slug = slugify(title)
        # Add timestamp to ensure uniqueness
        slug = f"{slug}-{int(datetime.now().timestamp())}"

        data = {
            "merchant_id": MERCHANT_ID,
            "title": title,
            "slug": slug,
            "content": content,
            "status": "draft",
            "featured_image_url": image_url,
            "author_name": "Ogabassey AI",
            # DB handles created_at/updated_at
        }
        
        response = supabase.table("blog_posts").insert(data).execute()
        return f"Successfully saved draft: {title} (Slug: {slug})"
        
    except Exception as e:
        return f"Error saving draft to database: {str(e)}"
