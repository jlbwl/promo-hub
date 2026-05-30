#!/bin/bash

set -e

echo "=========================================="
echo "Emergency Fix for Missing Static Files"
echo "=========================================="
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"

echo "[Step 1] Creating directory structure..."
mkdir -p "$DEPLOY_DIR/user" "$DEPLOY_DIR/admin" "$DEPLOY_DIR/manager" "$DEPLOY_DIR/api"
echo "✓ Directories created"

echo ""
echo "[Step 2] Creating minimal index.html for user..."
cat > "$DEPLOY_DIR/user/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Loading...</title>
    <style>
        body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
        .loading { text-align: center; }
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="loading">
        <h2>Loading...</h2>
        <div class="spinner"></div>
        <p>Please wait while we deploy the application</p>
        <p><small>If this persists, please contact support</small></p>
    </div>
</body>
</html>
EOF
echo "✓ Created $DEPLOY_DIR/user/index.html"

echo ""
echo "[Step 3] Creating favicon.svg..."
cat > "$DEPLOY_DIR/user/vite.svg" << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#3b82f6"/>
  <circle cx="50" cy="50" r="35" fill="#ffffff"/>
  <path d="M35 50 L45 60 L65 40" stroke="#3b82f6" stroke-width="6" fill="none"/>
</svg>
EOF
cp "$DEPLOY_DIR/user/vite.svg" "$DEPLOY_DIR/user/favicon.svg"
echo "✓ Created favicon files"

echo ""
echo "[Step 4] Testing Nginx config..."
nginx -t

echo ""
echo "[Step 5] Reloading Nginx..."
nginx -s reload || sudo nginx -s reload || systemctl reload nginx || service nginx reload
echo "✓ Nginx reloaded"

echo ""
echo "[Step 6] Verifying fix..."
sleep 2
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" https://localhost/user/)
echo "HTTP status for /user/: $HTTP_STATUS"

if [ "$HTTP_STATUS" = "200" ]; then
    echo ""
    echo "✅ SUCCESS! Site should now be accessible at https://www.jlbtg.cn/user/"
    echo ""
    echo "Note: This is a temporary placeholder. Please trigger a new GitHub Actions deployment"
    echo "to deploy the actual application code."
else
    echo ""
    echo "❌ FAILED: Site still returning $HTTP_STATUS"
    echo "Please check Nginx configuration manually."
fi

echo ""
echo "=========================================="
