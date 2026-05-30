#!/bin/bash

echo "=========================================="
echo "Nginx 403 Permission Fix"
echo "=========================================="
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"

echo "[Step 1] Checking directory permissions..."
if [ -d "$DEPLOY_DIR" ]; then
    CURRENT_PERMS=$(stat -c '%a' $DEPLOY_DIR 2>/dev/null || stat -f '%Lp' $DEPLOY_DIR 2>/dev/null)
    CURRENT_OWNER=$(stat -c '%U:%G' $DEPLOY_DIR 2>/dev/null || stat -f '%Su:%Sg' $DEPLOY_DIR 2>/dev/null)
    echo "Current: $DEPLOY_DIR"
    echo "  Permissions: $CURRENT_PERMS"
    echo "  Owner:       $CURRENT_OWNER"
else
    echo "$DEPLOY_DIR does not exist, creating..."
    mkdir -p "$DEPLOY_DIR"
fi

echo ""
echo "[Step 2] Setting correct permissions..."
echo "Setting directories to 755..."
find "$DEPLOY_DIR" -type d -exec chmod 755 {} \; 2>/dev/null || echo "Note: Some directories skipped"

echo "Setting files to 644..."
find "$DEPLOY_DIR" -type f -exec chmod 644 {} \; 2>/dev/null || echo "Note: Some files skipped"

echo ""
echo "[Step 3] Determining Nginx user..."
NGINX_USER=$(ps aux | grep -E 'nginx|nginx:' | grep -v grep | head -1 | awk '{print $1}' 2>/dev/null)
if [ -z "$NGINX_USER" ]; then
    NGINX_USER=$(grep -E '^user ' /etc/nginx/nginx.conf 2>/dev/null | awk '{print $2}' | tr -d ';' 2>/dev/null)
fi
if [ -z "$NGINX_USER" ]; then
    NGINX_USER="www-data"
fi
echo "Detected Nginx user: $NGINX_USER"

echo ""
echo "[Step 4] Setting ownership..."
echo "Changing ownership to $NGINX_USER:$NGINX_USER"
chown -R "$NGINX_USER:$NGINX_USER" "$DEPLOY_DIR" 2>/dev/null || \
chown -R "$NGINX_USER" "$DEPLOY_DIR" 2>/dev/null || \
echo "Note: Could not set ownership (may need sudo)"

echo ""
echo "[Step 5] Testing file access..."
if [ -f "$DEPLOY_DIR/user/index.html" ]; then
    echo "✓ $DEPLOY_DIR/user/index.html exists"
    ls -l "$DEPLOY_DIR/user/index.html"
else
    echo "✗ $DEPLOY_DIR/user/index.html is still missing!"
fi

echo ""
echo "[Step 6] Reloading Nginx..."
nginx -s reload 2>&1 || sudo nginx -s reload 2>&1 || systemctl reload nginx 2>&1 || service nginx reload 2>&1
echo "✓ Nginx reloaded"

echo ""
echo "[Step 7] Testing local access..."
sleep 1
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" http://localhost/user/)
echo "HTTP status (local): $HTTP_STATUS"

echo ""
echo "=========================================="
if [ "$HTTP_STATUS" = "200" ]; then
    echo "✅ SUCCESS! Permissions fixed!"
else
    echo "⚠️  Local test returned $HTTP_STATUS"
    echo "Try running this script with sudo"
fi
echo "=========================================="
