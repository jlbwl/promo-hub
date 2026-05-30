#!/bin/bash
# ============================================================
# 服务器清理脚本
# 清理旧的SSL证书配置，使用HTTP模式快速恢复网站
# ============================================================

echo "========================================================"
echo " 服务器清理和初始化"
echo "========================================================"

# 停止在错误时
set -e

# 第一步：备份旧证书
echo ""
echo "1. 备份旧的SSL证书..."
if [ -f "/etc/nginx/ssl/www.jlbtg.cn.pem" ] || [ -f "/etc/nginx/ssl/www.jlbtg.cn.key" ]; then
    mkdir -p /etc/nginx/ssl/backup
    BACKUP_TIME=$(date +%Y%m%d-%H%M%S)
    
    if [ -f "/etc/nginx/ssl/www.jlbtg.cn.pem" ]; then
        mv -f /etc/nginx/ssl/www.jlbtg.cn.pem \
            "/etc/nginx/ssl/backup/www.jlbtg.cn.pem.$BACKUP_TIME"
    fi
    
    if [ -f "/etc/nginx/ssl/www.jlbtg.cn.key" ]; then
        mv -f /etc/nginx/ssl/www.jlbtg.cn.key \
            "/etc/nginx/ssl/backup/www.jlbtg.cn.key.$BACKUP_TIME"
    fi
    
    echo "✅ 旧证书已备份到 /etc/nginx/ssl/backup/"
else
    echo "✅ 没有发现旧证书需要备份"
fi

# 第二步：清理Nginx配置目录
echo ""
echo "2. 清理Nginx配置目录..."
rm -f /etc/nginx/conf.d/*.conf 2>/dev/null
rm -f /etc/nginx/sites-enabled/* 2>/dev/null
echo "✅ Nginx配置目录已清理"

# 第三步：部署HTTP-only配置
echo ""
echo "3. 部署HTTP-only配置..."
cat > /etc/nginx/conf.d/promo-hub.conf << 'EOF'
server {
    listen 80;
    server_name www.jlbtg.cn jlbtg.cn;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
    gzip_min_length 1024;
    
    # Let's Encrypt ACME 验证路径
    location /.well-known/acme-challenge/ {
        root /var/www/html;
        allow all;
    }
    
    # 管理员后台
    location /admin/ {
        alias /www/wwwroot/promo-hub/admin/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }
    
    # 渠道经理后台
    location /manager/ {
        alias /www/wwwroot/promo-hub/manager/;
        index index.html;
        try_files $uri $uri/ /manager/index.html;
    }
    
    # 用户端
    location /user/ {
        alias /www/wwwroot/promo-hub/user/;
        index index.html;
        try_files $uri $uri/ /user/index.html;
    }
    
    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # 根路径跳转到用户端
    location = / {
        return 302 /user/;
    }
}
EOF
echo "✅ HTTP-only配置已部署"

# 第四步：测试并重载Nginx
echo ""
echo "4. 测试并重载Nginx..."
nginx -t
if [ $? -ne 0 ]; then
    echo "❌ Nginx 配置验证失败！"
    exit 1
fi

nginx -s reload
echo "✅ Nginx 已成功重载"

# 第五步：检查API服务
echo ""
echo "5. 检查API服务..."
if command -v pm2 >/dev/null 2>&1; then
    PM2_STATUS=$(pm2 status --no-color 2>&1 || true)
    if echo "$PM2_STATUS" | grep -q "promo-api"; then
        echo "✅ API服务(promo-api)正在运行"
    else
        echo "⚠️  未发现API服务，尝试启动..."
        if [ -f "/www/wwwroot/promo-hub/api/index.js" ]; then
            cd /www/wwwroot/promo-hub/api
            pm2 start index.js --name promo-api 2>&1 || true
            echo "✅ API服务已启动"
        else
            echo "⚠️  API文件不存在"
        fi
    fi
else
    echo "⚠️  pm2未安装"
fi

# 完成
echo ""
echo "========================================================"
echo " 🎉 清理和初始化完成！"
echo "========================================================"
echo ""
echo "网站现在以HTTP模式运行"
echo "访问地址: http://www.jlbtg.cn"
echo ""
echo "下一步："
echo "  1. 从阿里云下载SSL证书"
echo "  2. 使用 upload-ssl-cert.sh 上传证书"
echo "  3. 再次运行 server-deploy.sh 启用HTTPS"
echo ""
