#!/bin/bash
# ============================================================
# 自动修复证书时间问题（非交互式）
# ============================================================

echo "========================================================"
echo "自动修复证书时间"
echo "========================================================"

# 1. 检查并尝试同步系统时间
echo ""
echo "1. 检查系统时间..."
ORIGINAL_DATE=$(date)
echo "当前时间: $ORIGINAL_DATE"

# 尝试同步 NTP 时间（如果可用）
if command -v ntpdate &> /dev/null; then
    echo "尝试 NTP 时间同步..."
    ntpdate -u pool.ntp.org 2>&1 || true
elif command -v timedatectl &> /dev/null; then
    echo "尝试启用 NTP 时间同步..."
    timedatectl set-ntp true 2>&1 || true
fi

echo "同步后时间: $(date)"

# 2. 备份旧证书（如果有）
echo ""
echo "2. 备份旧证书..."
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ] || [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    mkdir -p /etc/nginx/ssl/backup
    mv -f /etc/nginx/ssl/www.jlbtg.cn.pem /etc/nginx/ssl/backup/www.jlbtg.cn.pem.$(date +%s) 2>/dev/null || true
    mv -f /etc/nginx/ssl/www.jlbtg.cn.key /etc/nginx/ssl/backup/www.jlbtg.cn.key.$(date +%s) 2>/dev/null || true
fi

# 3. 强制重新生成证书
echo ""
echo "3. 重新生成证书..."
mkdir -p /etc/nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
    -out /etc/nginx/ssl/www.jlbtg.cn.pem \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
    -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1

chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key

# 4. 验证新证书
echo ""
echo "4. 验证新证书..."
echo "证书信息:"
openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:" || true

# 5. 重载 Nginx
echo ""
echo "5. 重载 Nginx..."
nginx -t
if [ $? -eq 0 ]; then
    nginx -s reload
    echo "✅ Nginx 已成功重载"
else
    echo "❌ Nginx 配置有问题，请检查"
fi

echo ""
echo "========================================================"
echo "修复完成！"
echo "请尝试访问 https://www.jlbtg.cn"
echo "========================================================"
