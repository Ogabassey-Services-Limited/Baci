
import os
import json
import re
import datetime
import hashlib
import asyncio
import requests
import base64
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Try importing from app package (VPS structure)
try:
    from app.publisher import fetch_tech_signals, publish_to_blog, get_supabase
except ImportError:
    # Dummy for local linting/testing
    def fetch_tech_signals(**kwargs): return []
    def publish_to_blog(**kwargs): return None
    def get_supabase(): return None

load_dotenv()

# ============================================================================
# CONFIGURATION
# ============================================================================

DAILY_ARTICLE_LIMIT = 2
# We don't use local file queues for multi-tenant effectively unless scoped by ID.
# For MVP Phase 1, we will process fresh feeds every run. 
# Ideally, we should check DB for duplicates (title/slug match).

# Models
TEXT_MODEL_PRIMARY = os.environ.get("WORKER_MODEL", "gemini-3-flash-preview")
CF_IMAGE_PROXY_URL = "https://gemini-image-proxy.ogabassey-ai.workers.dev"

# ============================================================================
# UTILS
# ============================================================================

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip("-")

def fetch_active_products(merchant_id: str):
    """Fetches active products for internal linking, scoped to merchant."""
    try:
        supabase = get_supabase()
        response = supabase.table("products").select("name, slug").eq("status", "active").eq("merchant_id", merchant_id).execute()
        return response.data or []
    except Exception as e:
        print(f"⚠️ Failed to fetch inventory for {merchant_id}: {e}")
        return []

UNRELEASED_PATTERNS = [
    r"s26", r"iphone 1[7-9]", r"pixel 1[0-9]", r"ps6", r"playstation 6", r"6g",
    r"galaxy z.*8", r"ios 19", r"android 16", r"concept", r"future"
]

def is_unreleased(name: str) -> bool:
    name_lower = name.lower()
    return any(re.search(p, name_lower) for p in UNRELEASED_PATTERNS)

def process_product_mentions(content: str, mentioned_names: list, inventory: list, domain_prefix="ogabassey.com") -> tuple[str, list]:
    """
    Links mentioned products to inventory and returns missing products.
    """
    missing = []
    linked_count = 0
    
    # Sort inventory by name length (desc)
    inventory.sort(key=lambda x: len(x.get("name", "")), reverse=True)
    
    for name in mentioned_names:
        found = False
        matcher = name.lower()
        for product in inventory:
            prod_name = product.get("name", "").lower()
            if matcher in prod_name or prod_name in matcher:
                slug = product["slug"]
                # Domain should ideally be dynamic (merchant.slug + baci.com or custom domain)
                # Phase 1: Default to ogabassey.com for Ogabassey
                url = f"https://{domain_prefix}/products/{slug}"
                
                pattern = re.compile(re.escape(name), re.IGNORECASE)
                content, count = pattern.subn(f'<a href="{url}" style="color: #0066cc; text-decoration: underline;">{name}</a>', content, count=1)
                if count > 0:
                    found = True
                    linked_count += 1
                break
        
        if not found:
            # Only flag as missing if it's NOT an unreleased/future product
            if not is_unreleased(name):
                missing.append(name)
            
    print(f"🔗 Linked {linked_count} products. Missing: {len(missing)}")
    return content, missing

def score_signal(signal: dict, keywords: list, brands: list) -> float:
    score = 0
    title_lower = signal.get("title", "").lower()
    
    # Base priority
    if signal.get("priority") == "high": score += 30
    elif signal.get("priority") == "medium": score += 20
    else: score += 10
    
    # Dynamic Scoring
    if any(kw.lower() in title_lower for kw in keywords): score += 25
    if any(brand.lower() in title_lower for brand in brands): score += 20
    
    # Viral Keywords (Global)
    VIRAL_KEYWORDS = ["leak", "price", "review", "vs", "worth buying", "hands-on"]
    if any(kw in title_lower for kw in VIRAL_KEYWORDS): score += 10
    
    # Recency
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

def map_to_pillar(signal: dict, pillars: dict) -> str:
    title_lower = signal.get("title", "").lower()
    for pillar, keywords in pillars.items():
        if any(kw in title_lower for kw in keywords): return pillar
    return "general"

# ============================================================================
# GENAI & IMAGE
# ============================================================================

def get_genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    return genai.Client(api_key=api_key) if api_key else None

async def generate_article_content(signal: dict, tone: str = "professional") -> Dict[str, Any]:
    client = get_genai_client()
    if not client: return {"title": signal["title"], "content": "<p>API Key missing</p>"}

    print(f"🧠 Generating text ({tone}) with {TEXT_MODEL_PRIMARY}...")
    
    prompt = f"""
    You are an expert tech blogger.
    Tone: {tone}
    TASK: Write a full blog article based on the following news signal.
    
    SOURCE SIGNAL:
    Title: {signal.get('title')}
    Summary: {signal.get('summary')}
    
    REQUIREMENTS:
    1. Title: SEO optimized, catchy.
    2. Context: Relate to the Nigerian/African market where applicable.
    3. Structure: HTML Format (<p>, <h2>, <ul>). NO Markdown.
    4. Output: strictly valid JSON with keys: "title", "content", "category", "tags", "meta_description", "mentioned_products" (list of product names to link).
    """
    
    try:
        response = client.models.generate_content(
            model=TEXT_MODEL_PRIMARY,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception as e:
        print(f"⚠️ Text Gen Failed: {e}")
        return {"title": signal["title"], "content": f"<p>{signal.get('summary')}</p>", "tags": []}

def generate_cover_image_via_proxy(prompt_text: str) -> Optional[str]:
    print(f"🎨 Generating image via Cloudflare proxy (gemini-2.5-flash-image)...")
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("⚠️ No API key for image generation")
        return None

    try:
        resp = requests.post(
            CF_IMAGE_PROXY_URL, 
            json={
                "prompt": f"Blog cover image, high tech, photorealistic: {prompt_text}", 
                "aspect_ratio": "16:9",
                "api_key": api_key
            },
            timeout=60
        )
        if resp.status_code == 200:
            data = resp.json()
            # Handle generic response or specific gemini response structure
            # The proxy might normalize it. Let's assume it returns standard gemini response structure based on previous logs?
            # Wait, final_pipeline_v10.py parses candidates.
            # But earlier successful run in final_pipeline_v10.py log said: "Image generated! Saving to CDN..."
            # Let's match final_pipeline_v10 logic exactly regarding parsing if possible.
            # Actually, `final_pipeline_v10.py` lines 248-265 handle complex parsing.
            # I should copy that parsing.
            
            if "candidates" in data:
                 # It's raw gemini response
                 candidates = data.get("candidates", [])
                 for candidate in candidates:
                    parts = candidate.get("content", {}).get("parts", [])
                    for part in parts:
                        inline_data = part.get("inlineData", {})
                        if inline_data.get("data"):
                             return inline_data.get("data")
            
            # Fallback if proxy normalizes it (some proxies do)
            if "image_base64" in data: return data["image_base64"]
            
        print(f"❌ Proxy Error {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"❌ Image Gen Error: {e}")
    return None

def save_image_locally(base64_data: str, filename: str) -> Optional[str]:
    try:
        save_dir = "/home/bassey/baci-cdn/public/core-assets/blog/generated"
        Path(save_dir).mkdir(parents=True, exist_ok=True)
        
        file_path = os.path.join(save_dir, filename)
        
        # Padding fix
        missing_padding = len(base64_data) % 4
        if missing_padding:
            base64_data += '=' * (4 - missing_padding)
            
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(base64_data))
        
        # Fix permissions
        try: os.chmod(file_path, 0o644)
        except: pass
            
        print(f"💾 Saved image to {file_path}")
        return f"https://cdn.ogabassey.com/core-assets/blog/generated/{filename}"
    except Exception as e:
        print(f"❌ Save failed: {e}")
        return None

# ============================================================================
# NOTIFICATIONS (Multi-Tenant)
# ============================================================================

def send_zepto_email(article: dict, missing_products: list, recipient_emails: list):
    token = os.environ.get("ZEPTOMAIL_TOKEN")
    if not token or not recipient_emails:
        print("⚠️ Email skipped (Token missing or no recipients).")
        return

    url = "https://api.zeptomail.com/v1.1/email"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": token
    }
    
    # Format recipients
    to_list = [{"email_address": {"address": email, "name": "Admin"}} for email in recipient_emails]

    status_html = ""
    if missing_products:
        status_html += "<div style='background: #fff3cd; padding: 10px; margin: 10px 0; border: 1px solid #ffeeba; border-radius: 4px;'>"
        status_html += "<h3>⚠️ Missing Products Detected</h3>"
        status_html += "<ul>" + "".join([f"<li>{p}</li>" for p in missing_products]) + "</ul></div>"
    
    payload = {
        "from": { "address": "noreply@usebaci.com", "name": "Baci Agent" },
        "to": to_list,
        "subject": f"Draft Ready: {article.get('title')}",
        "htmlbody": f"<h1>New Draft</h1><p>{article.get('title')}</p>{status_html}",
    }
    
    try:
        resp = requests.post(url, json=payload, headers=headers)
        if resp.status_code in [200, 201]:
             print(f"✅ Email sent to {len(to_list)} recipients")
        else:
             print(f"❌ Email failed: {resp.text}")
    except Exception as e:
        print(f"❌ Email error: {e}")

# ============================================================================
# MAIN ORCHESTRATOR
# ============================================================================

async def process_agent(agent: dict, all_signals: list):
    m_id = agent['merchant_id']
    print(f"\n⚡ Processing Agent for Merchant: {m_id}")
    
    keywords = agent.get('keywords') or []
    brands = agent.get('inventory_brands') or []
    recipients = agent.get('email_recipients') or []
    pillars = agent.get('content_pillars') or {}
    tone = agent.get('tone_voice') or "professional"
    
    # 1. Fetch Inventory
    inventory = fetch_active_products(m_id)
    print(f"   📦 Inventory: {len(inventory)} items")
    
    # 2. Score & Filter
    scored = []
    for s in all_signals:
        s_c = s.copy()
        score = score_signal(s_c, keywords, brands)
        if score > 20: # Relevance threshold
            s_c['score'] = score
            s_c['pillar'] = map_to_pillar(s_c, pillars)
            scored.append(s_c)
            
    scored.sort(key=lambda x: x['score'], reverse=True)
    top_candidates = scored[:DAILY_ARTICLE_LIMIT + 3] # Look at a few more to find uniques
    
    # DEDUPLICATION LOGIC
    processed_titles = []
    final_signals = []
    
    for signal in top_candidates:
        if len(final_signals) >= DAILY_ARTICLE_LIMIT: break
        
        # Simple fuzzy check for topic overlap
        is_dup = False
        words_a = set(re.findall(r'\w+', signal['title'].lower()))
        
        for pt in processed_titles:
            words_b = set(re.findall(r'\w+', pt.lower()))
            # Jaccard similarity > 0.3 implies high overlap for short headlines
            intersection = len(words_a & words_b)
            union = len(words_a | words_b)
            if union > 0 and (intersection / union) > 0.3: 
                print(f"⏩ Skipping duplicate topic: '{signal['title']}' (matches '{pt}')")
                is_dup = True
                break
        
        if not is_dup:
            final_signals.append(signal)
            processed_titles.append(signal['title'])
            
    top_signals = final_signals
    print(f"   📰 Relevant Signals: {len(top_signals)} (Processing Top {len(top_signals)})")
    
    for signal in top_signals:
        print(f"   ✨ Generating: {signal['title']}")
        
        # Content
        article_data = await generate_article_content(signal, tone)
        content = article_data.get("content", "")
        
        # Internal Linking
        domain_prefix = "ogabassey.com" # TODO: Fetch from merchant config if different
        content, missing = process_product_mentions(content, article_data.get("mentioned_products", []), inventory, domain_prefix)
        article_data["content"] = content
        
        # Image
        image_url = None
        if CF_IMAGE_PROXY_URL:
             clean = "".join(c for c in signal["title"] if c.isalnum())[:50]
             fname = f"{clean}-{int(datetime.datetime.now().timestamp())}.png"
             b64 = generate_cover_image_via_proxy(signal["title"])
             if b64: image_url = save_image_locally(b64, fname)
             
        # Publish
        pub_id = publish_to_blog(
            title=article_data.get("title", signal["title"]),
            content=article_data["content"],
            category="News",
            tags=article_data.get("tags", []),
            status="draft",
            featured_image_url=image_url,
            merchant_id=m_id
        )
        
        if pub_id:
            # Email
            art_info = {"title": article_data.get("title", signal["title"])}
            send_zepto_email(art_info, missing, recipients)

async def run_pipeline():
    print(f"\n============================================================")
    print(f"🚀 MULTI-TENANT PIPELINE - {datetime.datetime.now().isoformat()}")
    print(f"============================================================")
    
    supabase = get_supabase()
    
    # 1. Fetch Agents
    try:
        res = supabase.table("merchant_agents").select("*").eq("status", "active").execute()
        agents = res.data or []
    except Exception as e:
        print(f"❌ Failed to fetch agents: {e}")
        return

    if not agents:
        print("ℹ️ No active agents found.")
        return
        
    print(f"👥 Found {len(agents)} active agents.")

    # 2. Fetch Signals (Global)
    all_signals = fetch_tech_signals()
    if not all_signals:
        print("ℹ️ No news signals found.")
        return

    # 3. Iterate
    for agent in agents:
        await process_agent(agent, all_signals)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
