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
| `search_products` | Search products by name, price range |
| `get_product` | Get detailed product information |
| `check_order` | Look up order by number or phone |
| `get_store_info` | Shipping, returns, payment info |
| `get_recommendations` | AI-powered product recommendations |

## Example Prompts

Once connected, users can ask:

- "Show me phones under 500,000 naira"
- "What's the iPhone 15 Pro Max price?"
- "Where's my order ORD-12345?"
- "What's your shipping policy?"
- "I need a laptop for gaming, budget 800k"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
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
