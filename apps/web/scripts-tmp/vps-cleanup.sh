#!/bin/bash
# VPS Cleanup Script - Remove OgaBassey and keep only CDN
# Run this on your VPS after reviewing the commands

set -e

echo "=============================================="
echo "VPS Cleanup - OgaBassey Removal"
echo "=============================================="
echo ""
echo "This script will:"
echo "1. Stop and remove OgaBassey containers"
echo "2. Remove OgaBassey application files"
echo "3. Clean up unused Docker resources"
echo "4. Keep only CDN/static file serving"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Step 1: Stopping OgaBassey services..."
echo "--------------------------------------"

# Stop PM2 processes if running
if command -v pm2 &> /dev/null; then
    echo "Stopping PM2 processes..."
    pm2 stop all 2>/dev/null || true
    pm2 delete all 2>/dev/null || true
    pm2 save --force 2>/dev/null || true
fi

# Stop Docker containers related to ogabassey
if command -v docker &> /dev/null; then
    echo "Stopping Docker containers..."
    docker ps -a --filter "name=ogabassey" -q | xargs -r docker stop 2>/dev/null || true
    docker ps -a --filter "name=ogabassey" -q | xargs -r docker rm 2>/dev/null || true
    docker ps -a --filter "name=baci" -q | xargs -r docker stop 2>/dev/null || true
    docker ps -a --filter "name=baci" -q | xargs -r docker rm 2>/dev/null || true
fi

# Stop systemd services if any
if systemctl list-units --type=service | grep -q ogabassey; then
    echo "Stopping systemd services..."
    sudo systemctl stop ogabassey 2>/dev/null || true
    sudo systemctl disable ogabassey 2>/dev/null || true
fi

echo ""
echo "Step 2: Removing application files..."
echo "--------------------------------------"

# Common deployment locations - adjust as needed
DIRS_TO_CHECK=(
    "/var/www/ogabassey"
    "/home/deploy/ogabassey"
    "/home/ubuntu/ogabassey"
    "/opt/ogabassey"
    "/var/www/baci"
    "/home/deploy/baci"
    "/home/ubuntu/baci"
    "/opt/baci"
)

for dir in "${DIRS_TO_CHECK[@]}"; do
    if [ -d "$dir" ]; then
        echo "Found: $dir"
        read -p "Delete $dir? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            sudo rm -rf "$dir"
            echo "Deleted: $dir"
        fi
    fi
done

echo ""
echo "Step 3: Cleaning up Docker..."
echo "--------------------------------------"

if command -v docker &> /dev/null; then
    echo "Removing unused Docker images..."
    docker image prune -af 2>/dev/null || true

    echo "Removing unused Docker volumes..."
    docker volume prune -f 2>/dev/null || true

    echo "Removing unused Docker networks..."
    docker network prune -f 2>/dev/null || true

    echo "Docker system prune..."
    docker system prune -af --volumes 2>/dev/null || true
fi

echo ""
echo "Step 4: Cleaning up system..."
echo "--------------------------------------"

# Clean npm cache
if command -v npm &> /dev/null; then
    echo "Cleaning npm cache..."
    npm cache clean --force 2>/dev/null || true
fi

# Clean apt cache (Ubuntu/Debian)
if command -v apt &> /dev/null; then
    echo "Cleaning apt cache..."
    sudo apt autoremove -y 2>/dev/null || true
    sudo apt clean 2>/dev/null || true
fi

# Clean old logs
echo "Cleaning old logs..."
sudo journalctl --vacuum-time=7d 2>/dev/null || true
sudo find /var/log -type f -name "*.gz" -delete 2>/dev/null || true
sudo find /var/log -type f -name "*.1" -delete 2>/dev/null || true

echo ""
echo "Step 5: Nginx configuration for CDN..."
echo "--------------------------------------"

# Check if nginx is installed
if command -v nginx &> /dev/null; then
    echo "Nginx is installed."
    echo ""
    echo "Recommended CDN-only nginx config:"
    echo ""
    cat << 'NGINX_CONFIG'
# /etc/nginx/sites-available/cdn
server {
    listen 80;
    listen [::]:80;
    server_name cdn.ogabassey.com;  # Update with your CDN domain

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name cdn.ogabassey.com;  # Update with your CDN domain

    # SSL configuration (update paths)
    ssl_certificate /etc/letsencrypt/live/cdn.ogabassey.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cdn.ogabassey.com/privkey.pem;

    # Static files root
    root /var/www/cdn;

    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Cache headers for static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|webp|avif|woff|woff2|ttf|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
    }

    # Default location
    location / {
        try_files $uri $uri/ =404;
        add_header Access-Control-Allow-Origin "*";
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
NGINX_CONFIG
    echo ""
    echo "To apply:"
    echo "1. Save the above to /etc/nginx/sites-available/cdn"
    echo "2. sudo ln -sf /etc/nginx/sites-available/cdn /etc/nginx/sites-enabled/"
    echo "3. Remove old site configs from /etc/nginx/sites-enabled/"
    echo "4. sudo nginx -t && sudo systemctl reload nginx"
fi

echo ""
echo "=============================================="
echo "Cleanup complete!"
echo "=============================================="
echo ""
echo "Disk space:"
df -h /
echo ""
echo "Memory:"
free -h
echo ""
echo "Next steps:"
echo "1. Review and update nginx config for CDN-only"
echo "2. Ensure SSL certs are valid for CDN domain"
echo "3. Test CDN file serving"
echo "4. Consider setting up a cron for log rotation"
