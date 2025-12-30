"""
Production Content Pipeline for ogabassey.com
Uses direct Google GenAI SDK.
UPDATED V10: Uses Cloudflare Worker proxy for image generation to bypass geo-restrictions.
"""

import os
import json
import time
import datetime
import hashlib
import smtplib
import asyncio
import requests
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

DAILY_ARTICLE_LIMIT = 2
SIGNAL_QUEUE_FILE = "/home/bassey/ogabassey-agents/data/signal_queue.json"
PUBLISHED_LOG_FILE = "/home/bassey/ogabassey-agents/data/published_log.json"
ERROR_LOG_FILE = "/home/bassey/ogabassey-agents/logs/pipeline_errors.json"
EMAIL_RECIPIENT = "basseybjohn@gmail.com"

# Models
TEXT_MODEL_PRIMARY = os.environ.get("WORKER_MODEL", "gemini-3-flash-preview")

# Cloudflare Worker Proxy for Image Generation (bypasses UK geo-restriction)
CF_IMAGE_PROXY_URL = "https://gemini-image-proxy.ogabassey-ai.workers.dev"

CONTENT_PILLARS = {
    "smartphones": ["phone", "galaxy", "iphone", "tecno", "infinix", "xiaomi", "oppo", "vivo", "pixel", "oneplus"],
    "laptops": ["laptop", "macbook", "chromebook", "notebook", "thinkpad", "dell", "hp laptop", "asus laptop"],
    "gadgets": ["watch", "buds", "airpods", "earbuds", "headphones", "tablet", "ipad"],
    "leaks": ["leak", "rumor", "upcoming", "expected", "could", "might", "reportedly"],
    "releases": ["launch", "announce", "release", "unveiled", "official", "now available"],
    "guides": ["best", "vs", "compare", "how to", "guide", "review", "worth buying"]
}

NIGERIAN_KEYWORDS = ["nigeria", "naira", "lagos", "tecno", "infinix", "jumia", "konga", "slot nigeria"]
INVENTORY_BRANDS = ["samsung", "iphone", "apple", "macbook", "airpods", "galaxy", "xiaomi", "redmi", "pixel", "ps5"]
VIRAL_KEYWORDS = ["leak", "price", "review", "vs", "worth buying", "hands-on", "deal", "discount"]

import base64
try:
    from app.publisher import fetch_tech_signals, publish_to_blog, get_supabase
except ImportError:
    def fetch_tech_signals(**kwargs): return []
    def publish_to_blog(**kwargs): return None
    def get_supabase(): return None

# ============================================================================
# UTILS (Scoring/Queue)
# ============================================================================

def score_signal(signal: dict) -> float:
    score = 0
    title_lower = signal.get("title", "").lower()
    if signal.get("priority") == "high": score += 30
    elif signal.get("priority") == "medium": score += 20
    else: score += 10
    if any(kw in title_lower for kw in NIGERIAN_KEYWORDS): score += 25
    if any(brand in title_lower for brand in INVENTORY_BRANDS): score += 20
    if any(kw in title_lower for kw in VIRAL_KEYWORDS): score += 10
    published = signal.get("published")
    if published:
        try:
            pub_time = datetime.datetime.fromisoformat(published.replace("Z", "+00:00"))
            hours_old = (datetime.datetime.now(datetime.timezone.utc) - pub_time).total_seconds() / 3600
            if hours_old < 6: score += 15
            elif hours_old < 12: score += 12
            elif hours_old < 24: score += 8
        except: pass
    return score

def map_to_pillar(signal: dict) -> str:
    title_lower = signal.get("title", "").lower()
    for pillar, keywords in CONTENT_PILLARS.items():
        if any(kw in title_lower for kw in keywords): return pillar
    return "general"

def calculate_signal_hash(signal: dict) -> str:
    title = signal.get("title", "").lower()
    words = [w for w in title.split() if len(w) > 3][:10]
    normalized = " ".join(sorted(words))
    return hashlib.md5(normalized.encode()).hexdigest()[:16]

def deduplicate_signals(signals: list) -> list:
    seen_hashes = {}
    for signal in signals:
        signal["score"] = score_signal(signal)
        signal["pillar"] = map_to_pillar(signal)
        signal_hash = calculate_signal_hash(signal)
        if signal_hash not in seen_hashes or signal["score"] > seen_hashes[signal_hash]["score"]:
            seen_hashes[signal_hash] = signal
    return list(seen_hashes.values())

def load_queue() -> list:
    if os.path.exists(SIGNAL_QUEUE_FILE):
        try:
            with open(SIGNAL_QUEUE_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    return []

def save_queue(queue: list):
    Path(SIGNAL_QUEUE_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(SIGNAL_QUEUE_FILE, "w") as f: json.dump(queue, f, indent=2)

def add_to_queue(signals: list):
    queue = load_queue()
    existing_hashes = {calculate_signal_hash(s) for s in queue}
    for signal in signals:
        if calculate_signal_hash(signal) not in existing_hashes:
            signal["queued_at"] = datetime.datetime.now().isoformat()
            queue.append(signal)
    save_queue(queue)
    print(f"📦 Added {len(signals)} signals to queue")

def clean_stale_queue(max_age_hours=168):
    queue = load_queue()
    cutoff = (datetime.datetime.now() - datetime.timedelta(hours=max_age_hours)).isoformat()
    fresh = [s for s in queue if s.get("queued_at", "") > cutoff]
    if len(queue) > len(fresh): save_queue(fresh)

import re

# ... (rest of imports)

# ============================================================================
# GENAI IMPLEMENTATION
# ============================================================================

def get_genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key: return None
    return genai.Client(api_key=api_key)

async def generate_article_content(signal: dict) -> Dict[str, Any]:
    client = get_genai_client()
    if not client: return {"title": signal["title"], "content": "<p>API Key missing</p>"}

    print(f"🧠 Generating text with {TEXT_MODEL_PRIMARY}...")
    
    prompt = f"""
    You are an expert tech blogger for Ogabassey.com (Nigerian Tech Store).
    TASK: Write a full blog article based on the following news signal.
    
    SOURCE SIGNAL:
    Title: {signal.get('title')}
    Summary: {signal.get('summary')}
    Source: {signal.get('source')}
    
    REQUIREMENTS:
    1. Title: SEO optimized, catchy.
    2. Context: Relate to Nigerian market (mention prices in Naira if possible, availability in Lagos).
    3. Structure: Introduction, Key Features/Details (Use semantic H2s), Availability/Price Analysis, Conclusion.
    4. Format: HTML (use <p>, <h2>, <ul>, <li>). NO Markdown blocks around the HTML.
    5. Output: Return strictly valid JSON with keys: "title", "content", "category", "tags", "meta_description", "mentioned_products" (list of specific product names mentioned, e.g. ["Pixel Watch 4", "Samsung S24"])
    """
    
    try:
        response = client.models.generate_content(
            model=TEXT_MODEL_PRIMARY,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        # Robust parsing
        text = response.text
        if "```json" in text:
             text = text.replace("```json", "").replace("```", "")
        text = text.strip()
        data = json.loads(text)
        if "mentioned_products" not in data: data["mentioned_products"] = []
        return data
    except Exception as e:
        print(f"⚠️ Primary text model failed/parsing error: {e}")
        return {
            "title": signal.get("title"), 
            "content": f"<p>{signal.get('summary')}</p><p><i>(AI generation pending review)</i></p>", 
            "category": "News", 
            "tags": ["Tech"],
            "mentioned_products": []
        }

def save_image_locally(base64_data: str, filename: str) -> Optional[str]:
    """Saves base64 image data to local CDN directory and returns public URL"""
    try:
        image_bytes = base64.b64decode(base64_data)
        
        # Define paths
        cdn_root = "/home/bassey/baci-cdn/public"
        rel_path = f"core-assets/blog/generated/{filename}"
        full_path = os.path.join(cdn_root, rel_path)
        
        # Ensure dir exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        
        # Write file
        with open(full_path, "wb") as f:
            f.write(image_bytes)
        
        # Ensure readable by web server (rw-r--r--)
        os.chmod(full_path, 0o644)
            
        print(f"💾 Saved image to {full_path}")
        
        # Return URL
        return f"https://cdn.ogabassey.com/{rel_path}"
        
    except Exception as e:
        print(f"❌ Save failed: {e}")
        return None

def generate_cover_image_via_proxy(title: str) -> Optional[str]:
    """
    Generate image via Cloudflare Worker proxy to bypass UK geo-restrictions.
    Uses gemini-2.5-flash-image via ogabassey-ai.workers.dev
    """
    print(f"🎨 Generating image via Cloudflare proxy (gemini-2.5-flash-image)...")
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("⚠️ No API key for image generation")
        return None
    
    prompt = f"Futuristic tech blog cover image for '{title}', 4k, digital art, no text"
    
    try:
        response = requests.post(
            CF_IMAGE_PROXY_URL,
            json={"prompt": prompt, "api_key": api_key},
            timeout=90
        )
        
        if response.status_code == 200:
            result = response.json()
            # Gemini 2.5 Flash Image returns: candidates[].content.parts[].inlineData
            candidates = result.get("candidates", [])
            for candidate in candidates:
                parts = candidate.get("content", {}).get("parts", [])
                for part in parts:
                    inline_data = part.get("inlineData", {})
                    b64_data = inline_data.get("data")
                    
                    if b64_data:
                        print("✅ Image generated! Saving to CDN...")
                        clean_filename = "".join([c for c in title if c.isalnum() or c in "-_"]).strip()[:50] + f"-{int(time.time())}.png"
                        public_url = save_image_locally(b64_data, clean_filename)
                        
                        if public_url:
                            print(f"✅ Image saved to: {public_url}")
                            return public_url
                        else:
                            print("⚠️ Save failed, returning placeholder")
                            return "https://cdn.ogabassey.com/core-assets/blog/generated-placeholder.jpg"
            
            # Check for errors in response
            if "error" in result:
                print(f"⚠️ Gemini API error: {result['error']}")
        else:
            print(f"⚠️ Proxy returned status {response.status_code}: {response.text[:200]}")
            
    except Exception as e:
        print(f"⚠️ Image generation via proxy failed: {e}")
        
    return None

# ============================================================================
# INVENTORY & LINKING
# ============================================================================

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip("-")

def fetch_active_products():
    """Fetches active products for internal linking."""
    try:
        supabase = get_supabase()
        response = supabase.table("products").select("name, slug").eq("status", "active").execute()
        return response.data
    except Exception as e:
        print(f"⚠️ Failed to fetch inventory: {e}")
        return []

def process_product_mentions(content: str, mentioned_names: list, inventory: list) -> tuple[str, list]:
    """
    Links mentioned products to inventory and returns missing products.
    Returns: (updated_content, missing_products_list)
    """
    missing = []
    linked_count = 0
    
    # Sort inventory by name length (desc) to match longest names first
    inventory.sort(key=lambda x: len(x.get("name", "")), reverse=True)
    
    for name in mentioned_names:
        found = False
        # 1. Exact/Substring Match in Inventory
        matcher = name.lower()
        for product in inventory:
            prod_name = product.get("name", "").lower()
            if matcher in prod_name or prod_name in matcher:
                # Link it!
                slug = product["slug"]
                url = f"https://ogabassey.com/products/{slug}"
                # Replace FIRST occurrence only to avoid over-linking
                # Use regex to avoid replacing inside existing tags
                pattern = re.compile(re.escape(name), re.IGNORECASE)
                content, count = pattern.subn(f'<a href="{url}" style="color: #0066cc; text-decoration: underline;">{name}</a>', content, count=1)
                if count > 0:
                    found = True
                    linked_count += 1
                break # Found the match for this mention
        
        if not found:
            missing.append(name)
            
    print(f"🔗 Linked {linked_count} products. Missing: {len(missing)}")
    return content, missing

# ============================================================================
# NOTIFICATIONS
# ============================================================================

def send_zepto_email(article: dict, missing_products: list = []):
    token = os.environ.get("ZEPTOMAIL_TOKEN")
    if not token:
        print("⚠️ No ZeptoMail token found. Email skipped.")
        return

    url = "https://api.zeptomail.com/v1.1/email"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": token
    }
    
    recipients = [
        {"email_address": {"address": "basseybjohn@gmail.com", "name": "Admin"}},
        {"email_address": {"address": "bolakale30@gmail.com", "name": "Admin"}}
    ]

    # Construct status section
    status_html = ""
    if missing_products:
        status_html += "<div style='background: #fff3cd; padding: 10px; margin: 10px 0; border: 1px solid #ffeeba; border-radius: 4px;'>"
        status_html += "<h3>⚠️ Missing Products Detected</h3>"
        status_html += "<p>The following products were mentioned but not found in active inventory. Please verify or upload them to enable internal linking:</p>"
        status_html += "<ul>"
        for prod in missing_products:
             status_html += f"<li>{prod}</li>"
        status_html += "</ul></div>"
    
    payload = {
        "from": { "address": "noreply@usebaci.com", "name": "Ogabassey Agent" },
        "to": recipients,
        "subject": f"Draft Ready: {article.get('title')}",
        "htmlbody": f"""
            <h1>New Draft Published</h1>
            <p><b>Title:</b> {article.get('title')}</p>
            <p><b>Status:</b> Draft</p>
            {status_html}
            <p>Please review and publish in the admin dashboard.</p>
        """,
    }
    
    try:
        resp = requests.post(url, json=payload, headers=headers)
        if resp.status_code in [200, 201]:
             print(f"✅ Email sent to admins")
        else:
             print(f"❌ Email failed: {resp.text}")
    except Exception as e:
        print(f"❌ Email error: {e}")

# ============================================================================
# RUN
# ============================================================================

async def run_pipeline():
    print(f"\n============================================================")
    print(f"🚀 PRODUCTION PIPELINE V11 (Links & Alerts) - {datetime.datetime.now().isoformat()}")
    print(f"============================================================")
    
    # 1. Fetch Inventory
    inventory = fetch_active_products()
    print(f"📦 Loaded {len(inventory)} active products from inventory")

    # 2. RSS Fetch
    signals = fetch_tech_signals()
    if not signals: return
    
    # 3. Process
    add_to_queue(signals)
    clean_stale_queue()
    
    queue = load_queue()
    # deduplicate_signals logic is conceptually inside load/add, but let's run it 
    # Actually dedupe is manual fn here, but add_to_queue handles deduping by hash.
    # Just take top items.
    
    # Filter for high score
    queue.sort(key=lambda x: x.get("score", 0), reverse=True)
    top_signals = queue[:2] # Process top 2
    
    for signal in top_signals:
        print(f"\n✨ Processing: {signal['title']}")
        
        # Check if already processed (naive check via title in CDN? - no DB track for now)
        # Assuming we just run.
        
        # A. Content
        article_data = await generate_article_content(signal)
        
        # B. Linking & Inventory Check
        content = article_data.get("content", "")
        mentioned = article_data.get("mentioned_products", []) 
        # Note: Need to update generate_article_content to return this list!
        # If not returned, we can't link effectively using this method. 
        # Fallback: Extract Noun Phrases? Too complex.
        # FIX: We will update generate_article_content prompt in next step.
        
        if mentioned:
            content, missing = process_product_mentions(content, mentioned, inventory)
        else:
            missing = []
            
        article_data["content"] = content
        
        # C. Image
        image_url = None
        if CF_IMAGE_PROXY_URL:
            # Clean title for filename
            clean_title = "".join(c for c in signal["title"] if c.isalnum())[:50]
            filename = f"{clean_title}-{int(datetime.datetime.now().timestamp())}.png"
            
            base64_img = generate_cover_image_via_proxy(signal["title"])
            if base64_img:
                image_url = save_image_locally(base64_img, filename)
                
        # D. Publish (Draft)
        article = {
            "title": article_data.get("title", signal["title"]),
            "slug": slugify(article_data.get("title", signal["title"])),
            "excerpt": article_data.get("meta_description", signal["summary"]),
            "content": article_data["content"],
            "published": True, # Draft
            "image": image_url,
            "category_id": "news", # simplified
            "author_id": "agent"
        }
        
        pub_id = publish_to_blog(
            title=article["title"],
            content=article["content"],
            category="News",
            tags=article_data.get("tags", []),
            status="draft",
            featured_image_url=image_url
        )
        if pub_id:
            print(f"✅ Published: {pub_id}")
            send_zepto_email(article, missing)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
