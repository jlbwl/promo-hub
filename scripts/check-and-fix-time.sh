#!/bin/bash
# ============================================================
# 检查并修复系统时间和证书
# ============================================================

echo "========================================================"
echo "系统时间检查和证书修复"
echo "========================================================"

# 1. 检查当前系统时间
echo ""
echo "1. 检查当前系统时间..."
CURRENT_DATE=$(date)
echo "当前系统时间: $CURRENT_DATE"

# 2. 检查证书时间
echo ""
echo "2. 检查证书时间..."
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After"
else
    echo "证书文件不存在"
fi

# 3. 询问用户是否需要调整时间
echo ""
read -p "是否需要修改系统时间到当前真实时间？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 尝试同步 NTP 时间
    echo "尝试同步 NTP 时间..."
    if command -v ntpdate &> /dev/null; then
        ntpdate -u pool.ntp.org 2>&1 || true
    elif command -v timedatectl &> /dev/null; then
        timedatectl set-ntp true 2>&1 || true
    fi
    
    # 再次显示时间
    echo "同步后的时间: $(date)"
fi

# 4. 重新生成证书（使用当前系统时间）
echo ""
read -p "是否重新生成证书？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "重新生成证书..."
    rm -f /etc/nginx/ssl/www.jlbtg.cn.pem
    rm -f /etc/nginx/ssl/www.jlbtg.cn.key
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
        -out /etc/nginx/ssl/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn"
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    
    echo ""
    echo "新证书时间:"
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After"
fi

# 5. 重载 Nginx
echo ""
read -p "是否重载 Nginx？(y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    nginx -t && nginx -s reload
    echo "✅ Nginx 已重载"
fi

echo ""
echo "========================================================"
echo "检查完成！"
echo "请尝试访问 https://www.jlbtg.cn"
echo "========================================================"
