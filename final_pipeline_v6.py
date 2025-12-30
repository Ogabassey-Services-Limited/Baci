"""
Production Content Pipeline for ogabassey.com
Handles: Signal scoring, deduplication, queuing, Gemini content generation, Image generation, and Email alerts.
Uses direct Google GenAI SDK to bypass ADK complexities.
"""

import os
import json
import time
import datetime
import hashlib
import smtplib
import asyncio
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
TEXT_MODEL_FALLBACK = "gemini-1.5-flash"
IMAGE_MODEL = "imagen-3.0-generate-001"

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

# Import Publisher safely
try:
    from app.publisher import fetch_tech_signals, publish_to_blog
except ImportError as e:
    print(f"⚠️ Error importing publisher: {e}")
    def fetch_tech_signals(**kwargs): return []
    def publish_to_blog(**kwargs): return None

# ============================================================================
# SCORING & DEDUPLICATION helpers
# ============================================================================
# (Reusing previous logic strictly)
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
        try: with open(SIGNAL_QUEUE_FILE, "r") as f: return json.load(f)
        except: pass
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

# ============================================================================
# GENAI IMPLEMENTATION
# ============================================================================

def get_genai_client():
    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key: return None
    return genai.Client(api_key=api_key)

async def generate_article_content(signal: dict) -> Dict[str, Any]:
    client = get_genai_client()
    if not client:
        return {"title": signal["title"], "content": "<p>API Key missing</p>"}

    print(f"🧠 Generating with {TEXT_MODEL_PRIMARY}...")
    
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
    3. Structure: 
       - Introduction
       - Key Features/Details (Use semantic H2s)
       - Availability/Price Analysis
       - Conclusion
    4. Format: HTML (use <p>, <h2>, <ul>, <li>). NO Markdown blocks around the HTML.
    5. Output: Return strictly valid JSON with keys: "title", "content", "category", "tags", "meta_description"
    
    Example Output Format:
    {{
      "title": "...",
      "content": "<p>...</p>",
      "category": "Smartphones",
      "tags": ["Samsung", "Tech"],
      "meta_description": "..."
    }}
    """
    
    try:
        response = client.models.generate_content(
            model=TEXT_MODEL_PRIMARY,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json" 
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Primary model failed: {e}. Trying fallback...")
        try:
             response = client.models.generate_content(
                model=TEXT_MODEL_FALLBACK,
                contents=prompt + "\nRETURN JSON ONLY.",
            )
             # Try clean json if model doesn't support json mode perfectly
             clean = response.text.replace("```json", "").replace("```", "").strip()
             return json.loads(clean)
        except Exception as e2:
             print(f"❌ Fallback failed: {e2}")
             return {
                 "title": signal["title"], 
                 "content": f"<p>{signal.get('summary')}</p><p><i>AI generation unavailable.</i></p>",
                 "category": "News",
                 "tags": ["Tech"]
             }

def generate_cover_image(title: str) -> Optional[str]:
    print("🎨 Generating cover image...")
    client = get_genai_client()
    if not client: return None
    
    try:
        prompt = f"Futuristic tech blog cover image for '{title}', 4k, digital art, no text"
        response = client.models.generate_images(
            model=IMAGE_MODEL,
            prompt=prompt,
            config=types.GenerateImagesConfig(number_of_images=1)
        )
        if response.generated_images:
             # In future: upload bytes to Supabase
             print("✅ Image generated (mock)")
             return "https://cdn.ogabassey.com/core-assets/blog/generated-placeholder.jpg"
    except Exception as e:
        print(f"⚠️ Image generation skipped: {e}")
        return None

def send_email_alert(article: dict):
    sender = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    if not sender: return
    try:
        msg = MIMEMultipart()
        msg['From'] = f"Ogabassey Agent <{sender}>"
        msg['To'] = EMAIL_RECIPIENT
        msg['Subject'] = f"Draft Ready: {article.get('title')}"
        msg.attach(MIMEText(f"<h1>New Draft</h1><p>{article.get('title')}</p>", 'html'))
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        print(f"📧 Alert sent to {EMAIL_RECIPIENT}")
    except Exception as e:
        print(f"❌ Email failed: {e}")

# ============================================================================
# RUN
# ============================================================================

async def run_pipeline():
    print("="*60)
    print(f"🚀 PRODUCTION PIPELINE V6 - {datetime.datetime.now().isoformat()}")
    print("="*60)
    
    clean_stale_queue()
    signals = fetch_tech_signals(hours_back=24)
    if not signals:
         print("No signals found.")
         return

    signals = deduplicate_signals(signals)
    signals.sort(key=lambda x: x.get("score", 0), reverse=True)
    
    top = signals[:DAILY_ARTICLE_LIMIT]
    overflow = signals[DAILY_ARTICLE_LIMIT:DAILY_ARTICLE_LIMIT+10]
    if overflow: add_to_queue(overflow)
    
    for s in top:
        print(f"\n✨ Processing: {s['title']}")
        article = await generate_article_content(s)
        
        img = generate_cover_image(article.get('title', ''))
        if img: article['featured_image_url'] = img
        
        pub_id = publish_to_blog(
            title=article.get('title', s['title']),
            content=article.get('content', ''),
            tags=article.get('tags', []),
            category=article.get('category', 'Tech'),
            status="draft",
            featured_image_url=article.get('featured_image_url')
        )
        if pub_id:
            send_email_alert(article)

if __name__ == "__main__":
    asyncio.run(run_pipeline())
