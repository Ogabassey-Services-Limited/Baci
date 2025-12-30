
import os
import datetime
from supabase import create_client, Client
import feedparser
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

# Load env in case this is run standalone
load_dotenv()

# =============================================================================
# SUPABASE HELPERS
# =============================================================================

def get_supabase() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    return create_client(url, key)

def get_ogabassey_merchant_id(supabase: Client) -> str:
    """Fetches the Ogabassey merchant ID."""
    try:
        # Try to find by slug 'ogabassey'
        res = supabase.table("merchants").select("id").eq("slug", "ogabassey").execute()
        if res.data and len(res.data) > 0:
            return res.data[0]['id']
        
        # Fallback: List all merchants
        res = supabase.table("merchants").select("id, name, slug").execute()
        if res.data:
            return res.data[0]['id'] # Return first one as fallback
            
    except Exception as e:
        print(f"Error fetching merchant ID: {e}")
        return None
    return None

# =============================================================================
# BLOG PUBLISHING TOOLS
# =============================================================================

def publish_to_blog(title: str, content: str, tags: List[str] = [], category: str = "Tech News", status: str = "draft", featured_image_url: Optional[str] = None, merchant_id: Optional[str] = None) -> Optional[str]:
    """
    Publishes a blog post to the 'blog_posts' table.
    Accepts explicit merchant_id for multi-tenancy.
    """
    try:
        supabase = get_supabase()
        
        # Use provided ID or fallback to Ogabassey (default behavior)
        if not merchant_id:
            merchant_id = get_ogabassey_merchant_id(supabase)
        
        if not merchant_id:
            print("❌ Could not find Merchant ID.")
            return None

        slug = title.lower().replace(" ", "-").replace(":", "").replace("?", "").replace("/", "")
        slug = "".join([c for c in slug if c.isalnum() or c == "-"])[:100] # Clean slug

        payload = {
            "merchant_id": merchant_id,
            "title": title,
            "slug": slug,
            "content": content,
            "tags": tags,
            "category": category,
            "status": status,
            "author_name": "Antigravity Agent",
            "published_at": datetime.datetime.now().isoformat(),
            "featured_image_url": featured_image_url
        }
        
        # Remove None values
        if featured_image_url is None:
            del payload["featured_image_url"]

        data = supabase.table("blog_posts").insert(payload).execute()
        
        if data.data:
            print(f"✅ Published '{title}' as {status} (ID: {data.data[0]['id']})")
            return data.data[0]['id']
        else:
            print(f"❌ Failed to publish '{title}'")
            return None
            
    except Exception as e:
        print(f"❌ Database Error: {e}")
        return None

# =============================================================================
# RSS FETCHING
# =============================================================================

TECH_RSS_FEEDS = [
    # Top Tier (Global)
    {"url": "https://www.theverge.com/rss/index.xml", "priority": "high", "source": "The Verge"},
    {"url": "https://techcrunch.com/feed/", "priority": "high", "source": "TechCrunch"},
    {"url": "https://www.engadget.com/rss.xml", "priority": "high", "source": "Engadget"},
    {"url": "https://arstechnica.com/feed/", "priority": "medium", "source": "Ars Technica"},
    {"url": "https://www.wired.com/feed/rss", "priority": "medium", "source": "Wired"},
    
    # Mobile Specific
    {"url": "https://www.gsmarena.com/rss-news-reviews.php3", "priority": "high", "source": "GSMArena"},
    {"url": "https://www.androidauthority.com/feed/", "priority": "medium", "source": "Android Authority"},
    {"url": "https://9to5google.com/feed/", "priority": "medium", "source": "9to5Google"},
    {"url": "https://9to5mac.com/feed/", "priority": "medium", "source": "9to5Mac"},
    
    # African/Nigerian Context
    {"url": "https://techcabal.com/feed/", "priority": "high", "source": "TechCabal"},
    {"url": "https://techpoint.africa/feed/", "priority": "high", "source": "Techpoint Africa"},
    {"url": "https://technext24.com/feed/", "priority": "medium", "source": "Technext"},
    {"url": "https://nairametrics.com/feed/", "priority": "medium", "source": "Nairametrics"},

    # PC/Gaming
    {"url": "https://www.pcgamer.com/rss/", "priority": "medium", "source": "PC Gamer"},
    {"url": "https://kotaku.com/rss", "priority": "low", "source": "Kotaku"},
    {"url": "https://www.polygon.com/rss/index.xml", "priority": "low", "source": "Polygon"},
    {"url": "https://www.tomshardware.com/feeds/all", "priority": "medium", "source": "Toms Hardware"},
    
    # specialized
    {"url": "https://www.notebookcheck.net/News.rss", "priority": "medium", "source": "Notebookcheck"},
    {"url": "https://www.xda-developers.com/feed/", "priority": "medium", "source": "XDA Developers"},
]

def fetch_tech_signals(hours_back: int = 24) -> List[Dict[str, Any]]:
    """
    Fetches latest tech news from RSS feeds.
    """
    signals = []
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(hours=hours_back)
    
    print(f"📡 Scanning {len(TECH_RSS_FEEDS)} RSS feeds...")
    
    for feed in TECH_RSS_FEEDS:
        try:
            parsed = feedparser.parse(feed["url"])
            if not parsed.entries:
                continue
                
            for entry in parsed.entries[:5]: # Check top 5 from each
                # Handle dates safely
                published_dt = None
                if hasattr(entry, "published_parsed") and entry.published_parsed:
                    published_dt = datetime.datetime(*entry.published_parsed[:6], tzinfo=datetime.timezone.utc)
                elif hasattr(entry, "updated_parsed") and entry.updated_parsed:
                    published_dt = datetime.datetime(*entry.updated_parsed[:6], tzinfo=datetime.timezone.utc)
                
                if published_dt and published_dt > cutoff:
                    signals.append({
                        "title": entry.title,
                        "link": entry.link,
                        "summary": getattr(entry, "summary", ""),
                        "published": published_dt.isoformat(),
                        "source": feed["source"],
                        "priority": feed["priority"]
                    })
        except Exception as e:
            # print(f"Error fetching {feed['url']}: {e}")
            continue
            
    print(f"📰 Found {len(signals)} signals from last {hours_back}h")
    return signals
