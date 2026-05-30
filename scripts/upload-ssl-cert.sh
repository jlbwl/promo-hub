#!/bin/bash
# ============================================================
# 上传阿里云 SSL 证书到服务器
# ============================================================

echo "========================================================"
echo " SSL 证书上传工具"
echo "========================================================"

# 显示帮助信息
show_help() {
    echo "使用方法:"
    echo "  $0 <证书文件> <私钥文件> [服务器地址]"
    echo ""
    echo "示例:"
    echo "  $0 ~/Downloads/www.jlbtg.cn.pem ~/Downloads/www.jlbtg.cn.key"
    echo "  $0 /path/to/cert.pem /path/to/cert.key root@your-server.com"
    echo ""
    echo "说明:"
    echo "  - 从阿里云控制台下载证书时，选择 Nginx 格式"
    echo "  - 证书文件通常名为: www.jlbtg.cn.pem"
    echo "  - 私钥文件通常名为: www.jlbtg.cn.key"
}

# 检查参数
if [ $# -lt 2 ]; then
    show_help
    exit 1
fi

CERT_FILE="$1"
KEY_FILE="$2"
SERVER_INFO="${3:-root@www.jlbtg.cn}"

# 验证文件存在
if [ ! -f "$CERT_FILE" ]; then
    echo "❌ 证书文件不存在: $CERT_FILE"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 私钥文件不存在: $KEY_FILE"
    exit 1
fi

# 显示证书信息
echo ""
echo "📄 证书文件: $CERT_FILE"
echo "🔑 私钥文件: $KEY_FILE"
echo "🌐 服务器: $SERVER_INFO"
echo ""

# 验证证书格式
echo "验证证书..."
if openssl x509 -in "$CERT_FILE" -noout 2>/dev/null; then
    CERT_SUBJECT=$(openssl x509 -in "$CERT_FILE" -subject -noout 2>&1 | sed 's/subject=//')
    CERT_DATES=$(openssl x509 -in "$CERT_FILE" -dates -noout 2>&1)
    echo "✅ 证书有效"
    echo "   $CERT_SUBJECT"
    echo "   $CERT_DATES"
else
    echo "❌ 证书文件格式不正确，请确认是 PEM 格式"
    exit 1
fi

# 上传到服务器
echo ""
echo "========================================================"
echo " 上传证书到服务器"
echo "========================================================"

# 复制证书到服务器
scp "$CERT_FILE" "$SERVER_INFO:/tmp/www.jlbtg.cn.pem"
if [ $? -ne 0 ]; then
    echo "❌ 证书上传失败"
    exit 1
fi

scp "$KEY_FILE" "$SERVER_INFO:/tmp/www.jlbtg.cn.key"
if [ $? -ne 0 ]; then
    echo "❌ 私钥上传失败"
    exit 1
fi

# 在服务器上安装证书
echo ""
echo "========================================================"
echo " 在服务器上安装证书"
echo "========================================================"

ssh "$SERVER_INFO" << 'EOF'
    # 创建证书目录
    mkdir -p /etc/nginx/ssl
    
    # 备份旧证书
    if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
        mkdir -p /etc/nginx/ssl/backup
        cp -f /etc/nginx/ssl/www.jlbtg.cn.pem "/etc/nginx/ssl/backup/www.jlbtg.cn.pem.$(date +%Y%m%d-%H%M%S)"
        echo "✅ 旧证书已备份"
    fi
    if [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
        cp -f /etc/nginx/ssl/www.jlbtg.cn.key "/etc/nginx/ssl/backup/www.jlbtg.cn.key.$(date +%Y%m%d-%H%M%S)"
    fi
    
    # 安装新证书
    mv -f /tmp/www.jlbtg.cn.pem /etc/nginx/ssl/www.jlbtg.cn.pem
    mv -f /tmp/www.jlbtg.cn.key /etc/nginx/ssl/www.jlbtg.cn.key
    
    # 设置正确的权限
    chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
    chmod 644 /etc/nginx/ssl/www.jlbtg.cn.pem
    chown -R root:root /etc/nginx/ssl/
    
    echo "✅ 证书已安装到 /etc/nginx/ssl/"
    
    # 显示证书信息
    echo ""
    echo "证书信息:"
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -subject -dates -noout
    
    # 测试 Nginx 配置
    echo ""
    echo "测试 Nginx 配置..."
    if nginx -t; then
        echo "✅ Nginx 配置验证通过"
        echo "正在重载 Nginx..."
        nginx -s reload
        echo "✅ Nginx 已重载成功"
    else
        echo "❌ Nginx 配置有错误，请检查"
        exit 1
    fi
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================================"
    echo " 🎉 SSL 证书安装成功！"
    echo "========================================================"
    echo ""
    echo "请访问: https://www.jlbtg.cn"
    echo ""
    echo "验证证书有效性:"
    echo "  1. 浏览器访问网站"
    echo "  2. 点击地址栏的锁图标"
    echo "  3. 检查证书是否显示为受信任"
    echo ""
else
    echo ""
    echo "❌ 证书安装失败，请检查上述错误信息"
    exit 1
fi
