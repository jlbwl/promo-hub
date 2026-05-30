#!/bin/bash

echo "=== Server Directory Structure Check ==="
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"

echo "1. Checking if ${DEPLOY_DIR} exists..."
if [ -d "$DEPLOY_DIR" ]; then
    echo "   ✓ Directory exists"
else
    echo "   ✗ Directory does NOT exist"
    echo "   Creating directory..."
    mkdir -p "$DEPLOY_DIR"
    echo "   ✓ Directory created"
fi

echo ""
echo "2. Checking subdirectories..."
for dir in user admin manager api; do
    if [ -d "$DEPLOY_DIR/$dir" ]; then
        echo "   ✓ $DEPLOY_DIR/$dir exists"
    else
        echo "   ✗ $DEPLOY_DIR/$dir does NOT exist"
    fi
done

echo ""
echo "3. Checking static files in user directory..."
if [ -f "$DEPLOY_DIR/user/index.html" ]; then
    echo "   ✓ $DEPLOY_DIR/user/index.html exists"
    echo "   File size: $(stat -f%z "$DEPLOY_DIR/user/index.html" 2>/dev/null || stat -c%s "$DEPLOY_DIR/user/index.html" 2>/dev/null) bytes"
else
    echo "   ✗ $DEPLOY_DIR/user/index.html does NOT exist"
fi

echo ""
echo "4. Checking assets directory..."
if [ -d "$DEPLOY_DIR/user/assets" ]; then
    echo "   ✓ $DEPLOY_DIR/user/assets exists"
    echo "   Number of files: $(find "$DEPLOY_DIR/user/assets" -type f | wc -l)"
else
    echo "   ✗ $DEPLOY_DIR/user/assets does NOT exist"
fi

echo ""
echo "5. Checking Nginx configuration..."
if [ -f "/etc/nginx/conf.d/default.conf" ]; then
    echo "   Checking Nginx config location blocks..."
    grep -A 3 "location /user/" /etc/nginx/conf.d/default.conf || echo "   No /user/ location block found in default.conf"
fi

if [ -f "/etc/nginx/nginx.conf" ]; then
    if grep -q "ssl_certificate" /etc/nginx/nginx.conf; then
        echo "   ✓ SSL certificate configured in nginx.conf"
    else
        echo "   ✗ SSL certificate NOT configured in nginx.conf"
    fi
fi

echo ""
echo "6. Nginx error logs (last 10 lines)..."
if [ -f "/var/log/nginx/error.log" ]; then
    tail -n 10 /var/log/nginx/error.log
else
    echo "   Error log not found at /var/log/nginx/error.log"
fi

echo ""
echo "7. Testing HTTPS access to local files..."
curl -k -I https://localhost/user/ 2>&1 | head -5

echo ""
echo "=== Check Complete ==="
