#!/bin/bash
# VPS CDN Setup Script for Ogabassey
# Run this on the VPS: ssh bassey@82.29.190.219
# Then: sudo bash /tmp/setup-cdn.sh

set -e

echo "🚀 Setting up CDN structure for Ogabassey..."

# 1. Create CDN directory structure
echo "📁 Creating /var/www/cdn/ directories..."
mkdir -p /var/www/cdn/{products,brands,categories,misc}

# 2. Copy existing product images to new CDN location
echo "📦 Copying existing product images..."
if [ -d "/var/www/ogabassey-backend/assets/products" ]; then
    cp -r /var/www/ogabassey-backend/assets/products/* /var/www/cdn/products/ 2>/dev/null || true
    echo "   ✅ Copied $(ls /var/www/cdn/products/ | wc -l) images"
else
    echo "   ⚠️  No existing images found"
fi

# 3. Set permissions
echo "🔐 Setting permissions..."
chown -R www-data:www-data /var/www/cdn
chmod -R 755 /var/www/cdn

# 4. Create Nginx config for cdn.ogabassey.com
echo "⚙️  Creating Nginx configuration..."
cat > /etc/nginx/sites-available/cdn.ogabassey.com << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name cdn.ogabassey.com;
    
    root /var/www/cdn;
    
    # Aggressive caching (1 year)
    location ~* \.(jpg|jpeg|png|gif|webp|avif|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        add_header X-Content-Type-Options nosniff;
        
        # CORS for ogabassey.com
        add_header Access-Control-Allow-Origin "https://ogabassey.com";
        add_header Access-Control-Allow-Methods "GET, OPTIONS";
    }
    
    # Gzip compression
    gzip on;
    gzip_types image/svg+xml application/javascript text/css;
    
    # Logging
    access_log /var/log/nginx/cdn.ogabassey.access.log;
    error_log /var/log/nginx/cdn.ogabassey.error.log;
}
EOF

# 5. Enable the site
echo "🔗 Enabling cdn.ogabassey.com site..."
ln -sf /etc/nginx/sites-available/cdn.ogabassey.com /etc/nginx/sites-enabled/

# 6. Test Nginx config
echo "🧪 Testing Nginx configuration..."
nginx -t

# 7. Reload Nginx
echo "🔄 Reloading Nginx..."
systemctl reload nginx

# 8. Create test image
echo "🖼️  Creating test image..."
echo "CDN is working!" > /var/www/cdn/products/test.txt

echo ""
echo "✅ CDN Setup Complete!"
echo ""
echo "📋 Next Steps:"
echo "   1. Add DNS record: cdn.ogabassey.com -> $(curl -s ifconfig.me)"
echo "   2. Test: http://cdn.ogabassey.com/products/test.txt"
echo "   3. After Cloudflare SSL, test: https://cdn.ogabassey.com/products/test.txt"
echo ""
echo "📊 CDN Status:"
echo "   Products: $(ls /var/www/cdn/products/ | wc -l) files"
echo "   Brands: $(ls /var/www/cdn/brands/ | wc -l) files"
echo "   Categories: $(ls /var/www/cdn/categories/ | wc -l) files"
