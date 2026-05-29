#!/bin/bash
# 上传阿里云 SSL 证书到服务器
# 使用方法: bash upload-ssl-cert.sh /path/to/cert.pem /path/to/cert.key

if [ $# -ne 2 ]; then
    echo "使用方法: $0 <证书文件路径> <私钥文件路径>"
    echo "示例: $0 ~/Downloads/www.jlbtg.cn.pem ~/Downloads/www.jlbtg.cn.key"
    exit 1
fi

CERT_FILE="$1"
KEY_FILE="$2"

if [ ! -f "$CERT_FILE" ]; then
    echo "❌ 证书文件不存在: $CERT_FILE"
    exit 1
fi

if [ ! -f "$KEY_FILE" ]; then
    echo "❌ 私钥文件不存在: $KEY_FILE"
    exit 1
fi

echo "✅ 证书文件: $CERT_FILE"
echo "✅ 私钥文件: $KEY_FILE"
echo ""

# 尝试从环境变量或配置获取服务器信息
SERVER_HOST="${SERVER_HOST:-www.jlbtg.cn}"
SERVER_USER="${SERVER_USER:-root}"
SERVER_PORT="${SERVER_PORT:-22}"

echo "🚀 正在上传证书到服务器..."
echo "服务器: $SERVER_USER@$SERVER_HOST:$SERVER_PORT"
echo ""

# 创建临时目录用于上传
TMP_DIR=$(mktemp -d)
cp "$CERT_FILE" "$TMP_DIR/www.jlbtg.cn.pem"
cp "$KEY_FILE" "$TMP_DIR/www.jlbtg.cn.key"

# 上传到服务器
scp -P "$SERVER_PORT" "$TMP_DIR/www.jlbtg.cn.pem" "$TMP_DIR/www.jlbtg.cn.key" "$SERVER_USER@$SERVER_HOST:/tmp/"

if [ $? -eq 0 ]; then
    echo "✅ 证书上传成功！"
    echo ""
    echo "🔧 正在服务器上安装证书..."
    
    ssh -p "$SERVER_PORT" "$SERVER_USER@$SERVER_HOST" << 'EOF'
        mkdir -p /etc/nginx/ssl
        cp -f /tmp/www.jlbtg.cn.pem /etc/nginx/ssl/www.jlbtg.cn.pem
        cp -f /tmp/www.jlbtg.cn.key /etc/nginx/ssl/www.jlbtg.cn.key
        chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
        chmod 644 /etc/nginx/ssl/www.jlbtg.cn.pem
        
        echo "✅ 证书已安装到 /etc/nginx/ssl/"
        
        # 测试 Nginx 配置
        if nginx -t; then
            echo "✅ Nginx 配置验证通过，正在重载..."
            nginx -s reload
            echo "✅ Nginx 已重载！"
        else
            echo "❌ Nginx 配置有错误，请检查"
        fi
        
        # 清理临时文件
        rm -f /tmp/www.jlbtg.cn.pem /tmp/www.jlbtg.cn.key
EOF
    
    echo ""
    echo "🎉 证书安装完成！请访问 https://www.jlbtg.cn 验证"
else
    echo "❌ 上传失败，请检查服务器连接"
fi

# 清理本地临时文件
rm -rf "$TMP_DIR"
