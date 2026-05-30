#!/bin/bash
# ============================================================
# 生成超长期有效证书（从2020到2030年都有效）
# ============================================================

echo "========================================================"
echo "生成超长期有效证书"
echo "========================================================"

# 1. 备份旧证书
echo ""
echo "1. 备份旧证书..."
mkdir -p /etc/nginx/ssl/backup
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.pem /etc/nginx/ssl/backup/www.jlbtg.cn.pem.$(date +%s)
fi
if [ -f /etc/nginx/ssl/www.jlbtg.cn.key ]; then
    mv -f /etc/nginx/ssl/www.jlbtg.cn.key /etc/nginx/ssl/backup/www.jlbtg.cn.key.$(date +%s)
fi

# 2. 创建 OpenSSL 配置文件（用于设置自定义有效期）
echo ""
echo "2. 创建 OpenSSL 配置..."
cat > /tmp/openssl.cnf << 'OPENSSL_CONF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_ca

[dn]
C = CN
ST = Beijing
L = Beijing
O = Dev
OU = Dev
CN = www.jlbtg.cn
emailAddress = dev@jlbtg.cn

[v3_ca]
subjectAltName = DNS:www.jlbtg.cn, DNS:jlbtg.cn
basicConstraints = CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth, clientAuth
OPENSSL_CONF

# 3. 生成证书，使用 faketime 或者直接设置有效日期范围
# 注意：OpenSSL 1.1.1+ 支持 -days 参数，我们直接设 3650 天（10年）
echo ""
echo "3. 生成 10 年期证书..."
mkdir -p /etc/nginx/ssl

# 先尝试用标准方式生成 10 年期证书
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/www.jlbtg.cn.key \
    -out /etc/nginx/ssl/www.jlbtg.cn.pem \
    -config /tmp/openssl.cnf 2>&1

chmod 600 /etc/nginx/ssl/www.jlbtg.cn.key
chmod 644 /etc/nginx/ssl/www.jlbtg.cn.pem

# 4. 验证证书时间
echo ""
echo "4. 验证证书..."
if [ -f /etc/nginx/ssl/www.jlbtg.cn.pem ]; then
    echo "✅ 证书生成成功"
    echo ""
    echo "证书信息："
    openssl x509 -in /etc/nginx/ssl/www.jlbtg.cn.pem -text -noout | grep -A 2 -B 2 "Not Before\|Not After\|Subject:"
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
    echo "❌ Nginx 配置有问题"
    exit 1
fi

# 清理临时文件
rm -f /tmp/openssl.cnf

echo ""
echo "========================================================"
echo "🎉 成功！"
echo "证书有效期: 10 年"
echo "请访问：https://www.jlbtg.cn"
echo "========================================================"
