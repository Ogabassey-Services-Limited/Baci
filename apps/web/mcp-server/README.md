# Ogabassey ChatGPT MCP Server

This MCP (Model Context Protocol) server enables ChatGPT integration with the Ogabassey store, allowing customers to:

- Search products
- Get product details
- Check order status
- Get store information
- Receive product recommendations

## Quick Start

### Option 1: Docker (Recommended)

```bash
# From the mcp-server directory
cd mcp-server

# Build and run
docker-compose up -d

# Check logs
docker-compose logs -f
```

The server will be available at `http://localhost:8787/mcp`

### Option 2: npm

```bash
# From the project root
npm run mcp
```

## Exposing to the Internet

### For Development (ngrok)

```bash
# With Docker
docker-compose --profile dev up -d

# Or manually
ngrok http 8787
```

### For Production

Deploy to your VPS and set up a reverse proxy (nginx/traefik) pointing to port 8787.

Example nginx config:
```nginx
server {
    listen 443 ssl http2;
    server_name mcp.ogabassey.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Connecting to ChatGPT

1. Go to **ChatGPT Settings → Apps & Connectors → Advanced settings**
2. Enable **Developer mode**
3. Click **Create** under **Connectors**
4. Enter your MCP URL (e.g., `https://mcp.ogabassey.com/mcp` or your ngrok URL)
5. Name: "Ogabassey Store"
6. Description: "Search products, check orders, and get recommendations from Ogabassey"

## Available Tools

| Tool | Description |
|------|-------------|
| `browse_categories` | Browse active store categories |
| `cancel_agentic_checkout_session` | Cancel a mutable signed Baci agentic checkout session |
| `create_agentic_checkout_session` | Create a signed Baci agentic checkout session with authoritative totals and fulfillment options |
| `create_cart_link` | Create a storefront cart link for selected products |
| `get_agentic_checkout_session` | Read a signed Baci agentic checkout session state |
| `get_brands` | Browse active store brands |
| `get_product` | Get detailed product information |
| `get_product_variants` | Get variants, conditions, prices, and availability for a product |
| `get_recommendations` | AI-powered product recommendations |
| `get_shipping_quote` | Estimate delivery options for a destination |
| `get_store_info` | Shipping, returns, payment info |
| `render_products_widget` | Render product results in the ChatGPT widget UI |
| `search_products` | Search products by name, price range |
| `update_agentic_checkout_session` | Update items, shipping details, or fulfillment options on a signed Baci agentic checkout session |

## Example Prompts

Once connected, users can ask:

- "Show me phones under 500,000 naira"
- "What's the iPhone 15 Pro Max price?"
- "Where's my order ORD-12345?"
- "What's your shipping policy?"
- "I need a laptop for gaming, budget 800k"
- "Create a checkout session for two iPhone 15 Pro Max units"
- "Show me my current checkout session"
- "Update my checkout session to use my Lagos shipping address"
- "Cancel my current checkout session"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `OPENAI_AGENTIC_API_KEY` | Yes for checkout | Bearer token for Baci agentic checkout APIs |
| `OPENAI_AGENTIC_SIGNING_KEY` | Yes for checkout | HMAC signing key for Baci agentic checkout APIs |
| `MCP_AGENTIC_CHECKOUT_BASE_URL` | No | Baci storefront/API origin for agentic checkout (default: `https://ogabassey.com`) |
| `MCP_PORT` | No | Server port (default: 8787) |
| `NGROK_AUTHTOKEN` | No | ngrok auth token for dev tunnel |

## Testing

Test the MCP server with the official inspector:

```bash
npx @modelcontextprotocol/inspector@latest http://localhost:8787/mcp
```

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│     ChatGPT     │────▶│   MCP Server     │────▶│  Supabase   │
│  (OpenAI App)   │◀────│  (This Server)   │◀────│  Database   │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   Widget UI   │
                        │  (In ChatGPT) │
                        └──────────────┘
```
