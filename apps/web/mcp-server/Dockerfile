# Ogabassey ChatGPT MCP Server
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --production=false

# Copy server code
COPY mcp-server/ ./mcp-server/

# Expose MCP port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/ || exit 1

# Run the MCP server
CMD ["npx", "tsx", "mcp-server/server.ts"]
