#!/bin/bash
# ============================================================
# 服务器全面诊断脚本
# ============================================================

set -e

echo "=============================================="
echo "   项目服务器诊断"
echo "=============================================="
echo ""

DEPLOY_DIR="/www/wwwroot/promo-hub"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

# 1. 检查 Nginx 服务状态
echo "📊 [1/10] 检查 Nginx 状态..."
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx 正在运行"
else
    echo "❌ Nginx 未运行！"
    echo "尝试启动 Nginx..."
    systemctl start nginx || true
fi
echo ""

# 2. 检查 Nginx 配置是否正确
echo "🔧 [2/10] 检查 Nginx 配置文件..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo "✅ Nginx 配置文件语法正确"
else
    echo "❌ Nginx 配置文件有问题！"
    nginx -t
fi
echo ""

# 3. 检查 PM2 和后端服务
echo "📊 [3/10] 检查后端服务状态..."
if command -v pm2 &> /dev/null; then
    pm2 status
    echo ""
else
    echo "⚠️  未检测到 PM2"
fi

# 4. 检查部署目录文件
echo "📁 [4/10] 检查部署目录文件..."
echo "部署目录: $DEPLOY_DIR"
echo ""
ls -la "$DEPLOY_DIR" 2>/dev/null || echo "部署目录不存在或无法访问"
echo ""

echo "admin 目录:"
ls -la "$DEPLOY_DIR/admin" 2>/dev/null | head -20 || echo "admin 目录不存在"
echo ""

echo "manager 目录:"
ls -la "$DEPLOY_DIR/manager" 2>/dev/null | head -20 || echo "manager 目录不存在"
echo ""

echo "user 目录:"
ls -la "$DEPLOY_DIR/user" 2>/dev/null | head -20 || echo "user 目录不存在"
echo ""

echo "api 目录:"
ls -la "$DEPLOY_DIR/api" 2>/dev/null | head -20 || echo "api 目录不存在"
echo ""

# 5. 检查 SSL 证书
echo "🔐 [5/10] 检查 SSL 证书..."
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ] && [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    echo "✅ SSL 证书文件存在"
    echo ""
    echo "证书信息:"
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 "Subject:" || true
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 20 "Subject Alternative Name" || true
else
    echo "❌ SSL 证书文件缺失！"
fi
echo ""

# 6. 检查 Let's Encrypt 证书
echo "🔐 [6/10] 检查 Let's Encrypt 证书..."
if [ -f /etc/letsencrypt/live/www.jlbtg.cn/fullchain.pem ] && [ -f /etc/letsencrypt/live/www.jlbtg.cn/privkey.pem ]; then
    echo "✅ Let's Encrypt 证书存在"
else
    echo "⚠️  Let's Encrypt 证书未找到"
fi
echo ""

# 7. 检查端口监听
echo "🌐 [7/10] 检查端口监听..."
if command -v netstat &> /dev/null; then
    echo "端口 80:"
    netstat -tlnp 2>/dev/null | grep ":80" || echo "未监听 80"
    echo "端口 443:"
    netstat -tlnp 2>/dev/null | grep ":443" || echo "未监听 443"
    echo "端口 3000:"
    netstat -tlnp 2>/dev/null | grep ":3000" || echo "未监听 3000"
elif command -v ss &> /dev/null; then
    echo "端口 80:"
    ss -tlnp 2>/dev/null | grep ":80" || echo "未监听 80"
    echo "端口 443:"
    ss -tlnp 2>/dev/null | grep ":443" || echo "未监听 443"
    echo "端口 3000:"
    ss -tlnp 2>/dev/null | grep ":3000" || echo "未监听 3000"
fi
echo ""

# 8. 检查 Nginx 实际配置
echo "📄 [8/10] 检查实际生效的 Nginx 配置..."
echo "配置文件: $NGINX_CONF"
echo ""
if [ -f "$NGINX_CONF" ]; then
    cat "$NGINX_CONF"
else
    echo "⚠️  配置文件不存在"
fi
echo ""

# 9. 检查 API 进程
echo "🚀 [9/10] 检查 API 服务..."
if command -v pm2 &> /dev/null; then
    if pm2 list 2>/dev/null | grep -q "promo-api"; then
        echo "✅ 检测到 promo-api 服务"
        echo "尝试重启 API 服务..."
        pm2 restart promo-api || true
    else
        echo "⚠️  未检测到 promo-api 服务"
        if [ -f "$DEPLOY_DIR/api/index.js" ]; then
            echo "尝试启动 API 服务..."
            cd "$DEPLOY_DIR/api" || exit 1
            pm2 start index.js --name promo-api || true
        fi
    fi
fi
echo ""

# 10. 测试本地请求
echo "🧪 [10/10] 本地测试..."
echo "测试 /user/:"
curl -s -o /dev/null -w "%{http_code}" http://localhost/user/ || echo "无法访问"
echo ""
echo "测试 /admin/:"
curl -s -o /dev/null -w "%{http_code}" http://localhost/admin/ || echo "无法访问"
echo ""

echo ""
echo "=============================================="
echo "   诊断完成！"
echo "=============================================="
