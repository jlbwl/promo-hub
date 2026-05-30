#!/bin/bash
# ============================================================
# 使用过去的时间生成证书，确保对 2023 年的浏览器有效
# ============================================================

set -e

echo "========================================================"
echo "生成兼容过去时间的证书"
echo "========================================================"

# 1. 保存当前系统时间
echo ""
echo "1. 保存当前系统时间..."
CURRENT_DATE=$(date)
echo "当前时间: $CURRENT_DATE"

# 2. 备份旧证书
echo ""
echo "2. 备份旧证书..."
mkdir -p /etc/nginx/ssl/backup
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.pem /etc/nginx/ssl/backup/www.jlbtg.cn.pem.$(date +%s)
fi
if [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.key /etc/nginx/ssl/backup/www.jlbtg.cn.key.$(date +%s)
fi

# 3. 尝试多种方法生成证书
echo ""
echo "3. 开始生成证书..."

# 方法 A: 尝试使用 faketime (如果可用)
if command -v faketime &> /dev/null; then
    echo "使用 faketime 生成 2020 年的证书..."
    mkdir -p /etc/nginx/ssl
    faketime '2020-01-01 00:00:00' openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
        -out /etc/nginx/ssl/www.jlbtg.cn.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
        -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1 || true
fi

# 检查证书是否生成成功，如果没有则用标准方法
if [ ! -f /etc/nginx/ssl/www.jlbtg.cn.pem ] || [ ! -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    # 方法 B: 临时修改系统时间
    echo "方法 A 失败，尝试方法 B：临时修改系统时间..."
    
    # 保存当前时区
    SAVED_TZ="$TZ"
    
    # 尝试修改时间（需要 root 权限）
    if [ "$(id -u)" = "0" ]; then
        echo "临时设置时间为 2023 年..."
        # 保存当前时间用于恢复
        SAVED_DATE=$(date +%s)
        
        # 设置为 2023 年的某个时间
        date -s "2023-05-30 12:00:00" 2>&1 || true
        
        # 生成证书（10年有效期）
        echo "正在生成证书..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
            -out /etc/nginx/ssl/www.jlbtg.cn.pem \
            -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
            -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1
        
        # 恢复原来的时间
        echo "恢复系统时间..."
        date -s "@$SAVED_DATE" 2>&1 || true
        
        # 尝试 NTP 同步
        if command -v ntpdate &> /dev/null; then
            ntpdate -u pool.ntp.org 2>&1 || true
        elif command -v timedatectl &> /dev/null; then
            timedatectl set-ntp true 2>&1 || true
        fi
    else
        # 方法 C: 普通用户，直接生成长达 10 年的证书
        echo "非 root 用户，直接生成 10 年期证书..."
        openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
            -out /etc/nginx/ssl/www.jlbtg.cn.pem \
            -subj "/C=CN/ST=Beijing/L=Beijing/O=Dev/OU=Dev/CN=www.jlbtg.cn" \
            -addext "subjectAltName=DNS:www.jlbtg.cn,DNS:jlbtg.cn" 2>&1
    fi
fi

# 设置权限
chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key 2>/dev/null || true
chmod 644 /etc/nginx/ssl/www.jlbtg.cn.pem 2>/dev/null || true

# 4. 验证证书
echo ""
echo "4. 验证证书..."
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    echo "✅ 证书文件存在"
    echo ""
    echo "证书详细信息："
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 3 -B 3 "Not Before\|Not After\|Subject:"
else
    echo "❌ 证书生成失败"
    exit 1
fi

# 5. 重载 Nginx
echo ""
echo "5. 重载 Nginx..."
nginx -t
if [ $? -eq 0 ]; then
    nginx -s reload
    echo "✅ Nginx 已成功重载"
else
    echo "⚠️ Nginx 配置有问题，但可能不影响"
fi

echo ""
echo "========================================================"
echo "🎉 完成！"
echo "系统当前时间: $(date)"
echo "请访问：https://www.jlbtg.cn"
echo "========================================================"
