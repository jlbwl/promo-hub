#!/bin/bash

echo "=========================================="
echo "Server Diagnostic Script"
echo "=========================================="
echo ""

echo "[1] Checking deployment directory..."
DEPLOY_DIR="/www/wwwroot/promo-hub"
if [ -d "$DEPLOY_DIR" ]; then
    echo "✓ $DEPLOY_DIR exists"
    echo "  Permissions: $(stat -c '%a' $DEPLOY_DIR 2>/dev/null || stat -f '%Lp' $DEPLOY_DIR 2>/dev/null)"
else
    echo "✗ $DEPLOY_DIR does NOT exist!"
    echo "  Creating it now..."
    mkdir -p "$DEPLOY_DIR"
    echo "✓ Created $DEPLOY_DIR"
fi

echo ""
echo "[2] Checking subdirectories..."
for dir in user admin manager api; do
    if [ -d "$DEPLOY_DIR/$dir" ]; then
        FILE_COUNT=$(find "$DEPLOY_DIR/$dir" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo "✓ $dir/ exists ($FILE_COUNT files)"
    else
        echo "✗ $dir/ does NOT exist"
        echo "  Creating..."
        mkdir -p "$DEPLOY_DIR/$dir"
    fi
done

echo ""
echo "[3] Checking critical files..."
for file in user/index.html user/vite.svg user/favicon.svg; do
    if [ -f "$DEPLOY_DIR/$file" ]; then
        SIZE=$(stat -c%s "$DEPLOY_DIR/$file" 2>/dev/null || stat -f%z "$DEPLOY_DIR/$file" 2>/dev/null)
        echo "✓ $file ($SIZE bytes)"
    else
        echo "✗ $file is MISSING"
    fi
done

echo ""
echo "[4] Nginx configuration test..."
nginx -t 2>&1

echo ""
echo "[5] Nginx status..."
systemctl status nginx 2>&1 | head -5 || service nginx status 2>&1 | head -5 || echo "Cannot check nginx status"

echo ""
echo "[6] Recent Nginx errors..."
if [ -f /var/log/nginx/error.log ]; then
    echo "Last 10 error log entries:"
    tail -n 10 /var/log/nginx/error.log 2>/dev/null || echo "Cannot read error log"
else
    echo "No error log found at /var/log/nginx/error.log"
fi

echo ""
echo "[7] Testing HTTPS access..."
curl -k -I https://localhost/user/ 2>&1 | head -5
echo ""
curl -k -I https://localhost/favicon.ico 2>&1 | head -5

echo ""
echo "[8] Testing HTTP access..."
curl -I http://localhost/user/ 2>&1 | head -5

echo ""
echo "=========================================="
echo "Diagnostic Complete"
echo "=========================================="
echo ""
echo "NEXT STEPS:"
echo "1. If directories are missing, GitHub Actions deployment may have failed"
echo "2. Check GitHub Actions logs: https://github.com/jlbwl/promo-hub/actions"
echo "3. If files are missing, manually run deployment or check SSH keys"
