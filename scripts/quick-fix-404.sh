#!/bin/bash

echo "=== Quick Fix for 404 Error ==="
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"

echo "Step 1: Creating directories if they don't exist..."
mkdir -p "$DEPLOY_DIR/user" "$DEPLOY_DIR/admin" "$DEPLOY_DIR/manager" "$DEPLOY_DIR/api"
echo "✓ Directories created"

echo ""
echo "Step 2: Checking current file status..."
if [ ! -f "$DEPLOY_DIR/user/index.html" ]; then
    echo "⚠ Static files are missing in $DEPLOY_DIR/user/"
    echo ""
    echo "SOLUTION: You need to either:"
    echo "1. Trigger a new GitHub Actions deployment (recommended)"
    echo "   - Go to: https://github.com/your-repo/actions"
    echo "   - Click 'Deploy to Aliyun Server'"
    echo "   - Click 'Run workflow' button"
    echo ""
    echo "2. Or manually upload files via SCP"
    echo ""
    echo "Step 3: Testing current status..."
    curl -I https://www.jlbtg.cn/user/ 2>&1 | head -5
else
    echo "✓ Static files exist"
    echo "File check:"
    ls -lh "$DEPLOY_DIR/user/index.html"
fi

echo ""
echo "Step 4: Checking Nginx config..."
nginx -t 2>&1

echo ""
echo "Step 5: Reloading Nginx..."
nginx -s reload 2>&1 || echo "Note: Use 'sudo nginx -s reload' if needed"

echo ""
echo "=== Quick Fix Complete ==="
