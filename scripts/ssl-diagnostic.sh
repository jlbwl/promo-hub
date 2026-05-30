#!/bin/bash
# ============================================================
# SSL证书诊断脚本
# 全面检查SSL证书配置问题
# ============================================================

echo "========================================================"
echo " SSL证书诊断工具"
echo "========================================================"
echo ""

# 1. 检查证书文件是否存在
echo "1️⃣  检查证书文件是否存在..."
echo ""

CERT_FILE="/etc/nginx/ssl/www.jlbtg.cn.pem"
KEY_FILE="/etc/nginx/ssl/www.jlbtg.cn.key"

if [ -f "$CERT_FILE" ]; then
    echo "✅ 证书文件存在: $CERT_FILE"
    ls -la "$CERT_FILE"
else
    echo "❌ 证书文件不存在: $CERT_FILE"
    echo "   请先上传证书文件"
fi

if [ -f "$KEY_FILE" ]; then
    echo "✅ 私钥文件存在: $KEY_FILE"
    ls -la "$KEY_FILE"
else
    echo "❌ 私钥文件不存在: $KEY_FILE"
    echo "   请先上传私钥文件"
fi

echo ""

# 2. 检查证书文件权限
echo "2️⃣  检查证书文件权限..."
echo ""

if [ -f "$KEY_FILE" ]; then
    KEY_PERMS=$(stat -c "%a" "$KEY_FILE" 2>/dev/null || stat -f "%OLp" "$KEY_FILE")
    if [ "$KEY_PERMS" = "600" ]; then
        echo "✅ 私钥文件权限正确: 600"
    else
        echo "⚠️  私钥文件权限不正确: $KEY_PERMS (应为 600)"
        echo "   执行修复: chmod 600 $KEY_FILE"
    fi
fi

if [ -f "$CERT_FILE" ]; then
    CERT_PERMS=$(stat -c "%a" "$CERT_FILE" 2>/dev/null || stat -f "%OLp" "$CERT_FILE")
    if [ "$CERT_PERMS" = "644" ] || [ "$CERT_PERMS" = "600" ]; then
        echo "✅ 证书文件权限正确: $CERT_PERMS"
    else
        echo "⚠️  证书文件权限不正确: $CERT_PERMS (应为 644 或 600)"
        echo "   执行修复: chmod 644 $CERT_FILE"
    fi
fi

echo ""

# 3. 检查证书格式和有效性
echo "3️⃣  检查证书格式和有效性..."
echo ""

if [ -f "$CERT_FILE" ]; then
    if openssl x509 -in "$CERT_FILE" -noout 2>/dev/null; then
        echo "✅ 证书格式正确 (PEM格式)"
        
        CERT_SUBJECT=$(openssl x509 -in "$CERT_FILE" -subject -noout 2>&1 | sed 's/subject=//')
        CERT_DATES=$(openssl x509 -in "$CERT_FILE" -dates -noout 2>&1)
        CERT_EXPIRY=$(openssl x509 -in "$CERT_FILE" -enddate -noout 2>&1 | cut -d= -f2)
        
        echo "   证书主题: $CERT_SUBJECT"
        echo "   有效期: $CERT_DATES"
        
        # 检查证书是否过期
        EXPIRY_DATE=$(date -d "$CERT_EXPIRY" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$CERT_EXPIRY" +%s)
        CURRENT_DATE=$(date +%s)
        
        if [ "$CURRENT_DATE" -gt "$EXPIRY_DATE" ]; then
            echo "❌ 证书已过期！"
        elif [ "$CURRENT_DATE" -gt "$((EXPIRY_DATE - 2592000))" ]; then
            echo "⚠️  证书即将过期（30天内）"
        else
            echo "✅ 证书未过期"
        fi
    else
        echo "❌ 证书格式不正确，请确认是PEM格式"
        echo "   PEM格式证书应以 '-----BEGIN CERTIFICATE-----' 开头"
    fi
else
    echo "⚠️  无法检查证书格式（文件不存在）"
fi

echo ""

# 4. 检查私钥格式
echo "4️⃣  检查私钥格式..."
echo ""

if [ -f "$KEY_FILE" ]; then
    if openssl rsa -in "$KEY_FILE" -check -noout 2>/dev/null; then
        echo "✅ 私钥格式正确且有效"
    else
        echo "❌ 私钥格式不正确或无效"
        echo "   PEM格式私钥应以 '-----BEGIN PRIVATE KEY-----' 或 '-----BEGIN RSA PRIVATE KEY-----' 开头"
    fi
else
    echo "⚠️  无法检查私钥格式（文件不存在）"
fi

echo ""

# 5. 检查证书和私钥是否匹配
echo "5️⃣  检查证书和私钥是否匹配..."
echo ""

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    CERT_MODULUS=$(openssl x509 -in "$CERT_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)
    KEY_MODULUS=$(openssl rsa -in "$KEY_FILE" -noout -modulus 2>/dev/null | md5sum | cut -d' ' -f1)
    
    if [ "$CERT_MODULUS" = "$KEY_MODULUS" ]; then
        echo "✅ 证书和私钥匹配"
    else
        echo "❌ 证书和私钥不匹配！"
        echo "   请确认您上传的是同一套证书和私钥"
    fi
else
    echo "⚠️  无法检查匹配性（文件不存在）"
fi

echo ""

# 6. 检查Nginx配置
echo "6️⃣  检查Nginx配置..."
echo ""

NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

if [ -f "$NGINX_CONF" ]; then
    echo "✅ Nginx配置文件存在: $NGINX_CONF"
    
    # 检查配置中是否引用了正确的证书路径
    if grep -q "ssl_certificate /etc/nginx/ssl/www.jlbtg.cn.pem" "$NGINX_CONF"; then
        echo "✅ 配置中引用了正确的证书路径"
    else
        echo "⚠️  配置中证书路径可能不正确"
        grep "ssl_certificate" "$NGINX_CONF"
    fi
    
    # 测试Nginx配置
    echo ""
    echo "测试Nginx配置..."
    if nginx -t 2>&1; then
        echo "✅ Nginx配置验证通过"
    else
        echo "❌ Nginx配置验证失败"
        nginx -t 2>&1
    fi
else
    echo "❌ Nginx配置文件不存在: $NGINX_CONF"
fi

echo ""

# 7. 检查Nginx服务状态
echo "7️⃣  检查Nginx服务状态..."
echo ""

if systemctl is-active --quiet nginx; then
    echo "✅ Nginx服务正在运行"
    systemctl status nginx --no-pager | head -5
else
    echo "❌ Nginx服务未运行"
    echo "   尝试启动: systemctl start nginx"
fi

echo ""

# 8. 检查端口监听
echo "8️⃣  检查端口监听..."
echo ""

if netstat -tlnp 2>/dev/null | grep -q ":80 "; then
    echo "✅ 端口80正在监听"
else
    echo "⚠️  端口80未监听"
fi

if netstat -tlnp 2>/dev/null | grep -q ":443 "; then
    echo "✅ 端口443正在监听"
else
    echo "⚠️  端口443未监听"
fi

echo ""

# 9. 检查防火墙
echo "9️⃣  检查防火墙..."
echo ""

if command -v firewall-cmd >/dev/null 2>&1; then
    if firewall-cmd --list-ports 2>/dev/null | grep -q "80/tcp"; then
        echo "✅ 防火墙已开放80端口"
    else
        echo "⚠️  防火墙可能未开放80端口"
    fi
    
    if firewall-cmd --list-ports 2>/dev/null | grep -q "443/tcp"; then
        echo "✅ 防火墙已开放443端口"
    else
        echo "⚠️  防火墙可能未开放443端口"
    fi
elif command -v ufw >/dev/null 2>&1; then
    if ufw status 2>/dev/null | grep -q "80/tcp"; then
        echo "✅ 防火墙已开放80端口"
    else
        echo "⚠️  防火墙可能未开放80端口"
    fi
    
    if ufw status 2>/dev/null | grep -q "443/tcp"; then
        echo "✅ 防火墙已开放443端口"
    else
        echo "⚠️  防火墙可能未开放443端口"
    fi
else
    echo "⚠️  未检测到防火墙管理工具"
fi

echo ""

# 10. 测试HTTPS连接
echo "10️⃣ 测试HTTPS连接..."
echo ""

if command -v curl >/dev/null 2>&1; then
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://www.jlbtg.cn 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
        echo "✅ HTTPS连接成功 (HTTP状态码: $HTTP_CODE)"
    elif [ "$HTTP_CODE" = "000" ]; then
        echo "❌ HTTPS连接失败（无法建立连接）"
    else
        echo "⚠️  HTTPS连接异常 (HTTP状态码: $HTTP_CODE)"
    fi
else
    echo "⚠️  curl未安装，无法测试HTTPS连接"
fi

echo ""
echo "========================================================"
echo " 诊断完成"
echo "========================================================"
echo ""
echo "如果发现问题，请根据上述提示进行修复"
echo ""