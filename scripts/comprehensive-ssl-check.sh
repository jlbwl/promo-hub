#!/bin/bash

echo "============================================"
echo "SSL Certificate Comprehensive Diagnosis"
echo "============================================"

CERT_PATH="/etc/nginx/ssl/www.jlbtg.cn.pem"
KEY_PATH="/etc/nginx/ssl/www.jlbtg.cn.key"
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${YELLOW}Warning: Not running as root. Some checks may fail.${NC}"
fi

echo -e "\n${GREEN}[Step 1] Checking certificate files...${NC}"
# Check certificate
if [ -f "$CERT_PATH" ]; then
    echo -e "   ${GREEN}✅${NC} Certificate found: $CERT_PATH"
    CERT_COUNT=$(grep -c "BEGIN CERTIFICATE" "$CERT_PATH")
    echo "   Certificate count in file: $CERT_COUNT"
    if [ "$CERT_COUNT" -eq 1 ]; then
        echo -e "   ${YELLOW}⚠️${NC} Warning: Only 1 certificate found (no intermediate CA chain)"
        echo "   Consider combining with intermediate CA certificate"
    elif [ "$CERT_COUNT" -ge 2 ]; then
        echo -e "   ${GREEN}✅${NC} Full certificate chain found ($CERT_COUNT certificates)"
    fi
else
    echo -e "   ${RED}❌${NC} Certificate missing: $CERT_PATH"
    exit 1
fi

# Check private key
if [ -f "$KEY_PATH" ]; then
    echo -e "   ${GREEN}✅${NC} Private key found: $KEY_PATH"
else
    echo -e "   ${RED}❌${NC} Private key missing: $KEY_PATH"
    exit 1
fi

echo -e "\n${GREEN}[Step 2] Certificate details...${NC}"
echo "Issuer:"
openssl x509 -in "$CERT_PATH" -noout -issuer | sed 's/^/   /'
echo ""
echo "Validity:"
openssl x509 -in "$CERT_PATH" -noout -dates | sed 's/^/   /'
echo ""
echo "Subject:"
openssl x509 -in "$CERT_PATH" -noout -subject | sed 's/^/   /'
echo ""
echo "Domain (SAN):"
openssl x509 -in "$CERT_PATH" -noout -text | grep -A 1 "Subject Alternative Name" | sed 's/^/   /'

echo -e "\n${GREEN}[Step 3] Certificate and key matching...${NC}"
CERT_MOD=$(openssl x509 -noout -modulus -in "$CERT_PATH" | openssl md5)
KEY_MOD=$(openssl rsa -noout -modulus -in "$KEY_PATH" | openssl md5)

if [ "$CERT_MOD" == "$KEY_MOD" ]; then
    echo -e "   ${GREEN}✅${NC} Certificate and key match!"
else
    echo -e "   ${RED}❌${NC} Certificate and key DO NOT match!"
    echo "   Certificate MD5:  $CERT_MOD"
    echo "   Key MD5:         $KEY_MOD"
    exit 1
fi

echo -e "\n${GREEN}[Step 4] Certificate chain verification...${NC}"
echo "Testing certificate chain with OpenSSL..."
if echo | openssl s_client -connect www.jlbtg.cn:443 -servername www.jlbtg.cn 2>&1 | grep -q "Verify return code: 0 (ok)"; then
    echo -e "   ${GREEN}✅${NC} Certificate chain is valid!"
else
    echo -e "   ${YELLOW}⚠️${NC} Certificate chain verification has warnings (may still work)"
fi

echo -e "\n${GREEN}[Step 5] Checking Nginx configuration...${NC}"
if [ -f "$NGINX_CONF" ]; then
    echo -e "   ${GREEN}✅${NC} Nginx config found: $NGINX_CONF"
    
    # Check SSL directives
    echo "   SSL Configuration:"
    grep -E "ssl_certificate|ssl_protocols|ssl_ciphers" "$NGINX_CONF" | sed 's/^/      /'
    
    # Check if all SSL files exist
    echo "   Checking referenced SSL files..."
    for file in $(grep -oE 'ssl_certificate [^;]+' "$NGINX_CONF" | cut -d' ' -f2); do
        if [ -f "$file" ]; then
            echo -e "   ${GREEN}✅${NC} $file exists"
        else
            echo -e "   ${RED}❌${NC} $file NOT FOUND"
        fi
    done
else
    echo -e "   ${RED}❌${NC} Nginx config NOT found: $NGINX_CONF"
fi

echo -e "\n${GREEN}[Step 6] Nginx configuration test...${NC}"
nginx -t 2>&1
if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✅${NC} Nginx configuration test passed"
else
    echo -e "   ${RED}❌${NC} Nginx configuration test FAILED"
    exit 1
fi

echo -e "\n${GREEN}[Step 7] Service status...${NC}"
# Nginx status
if systemctl is-active --quiet nginx; then
    echo -e "   ${GREEN}✅${NC} Nginx is running"
elif pgrep nginx > /dev/null; then
    echo -e "   ${GREEN}✅${NC} Nginx is running (found process)"
else
    echo -e "   ${RED}❌${NC} Nginx is NOT running"
fi

# PM2 services
if command -v pm2 >/dev/null 2>&1; then
    echo "   PM2 services:"
    pm2 status | sed 's/^/   /'
else
    echo -e "   ${YELLOW}⚠️${NC} PM2 not installed"
fi

echo -e "\n${GREEN}[Step 8] Port listening...${NC}"
netstat -tlnp | grep -E ':(80|443|3000)' | sed 's/^/   /'

echo -e "\n${GREEN}[Step 9] Testing HTTPS connection...${NC}"
echo "Testing with curl..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://www.jlbtg.cn/ 2>&1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "   ${GREEN}✅${NC} HTTPS connection successful (HTTP $HTTP_CODE)"
else
    echo -e "   ${RED}❌${NC} HTTPS connection failed (HTTP $HTTP_CODE)"
fi

echo -e "\n${GREEN}[Step 10] Testing HTTP to HTTPS redirect...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L http://www.jlbtg.cn/ 2>&1)
FINAL_URL=$(curl -s -o /dev/null -w "%{url_effective}" -L http://www.jlbtg.cn/ 2>&1)
echo "   Redirect status: HTTP $HTTP_CODE"
echo "   Final URL: $FINAL_URL"
if [[ "$FINAL_URL" == https://* ]]; then
    echo -e "   ${GREEN}✅${NC} HTTP to HTTPS redirect working"
else
    echo -e "   ${YELLOW}⚠️${NC} Redirect may not be working correctly"
fi

echo -e "\n============================================"
echo "Diagnosis Complete!"
echo "============================================"
echo ""
echo "Summary:"
echo "1. Certificate files: $([ -f "$CERT_PATH" ] && echo 'Found' || echo 'MISSING')"
echo "2. Certificate chain: $([ "$CERT_COUNT" -ge 2 ] && echo 'Complete' || echo 'INCOMPLETE')"
echo "3. Certificate-Key match: $([ "$CERT_MOD" == "$KEY_MOD" ] && echo 'Yes' || echo 'NO')"
echo "4. Nginx config: $(nginx -t 2>&1 | grep -q 'syntax is ok' && echo 'Valid' || echo 'INVALID')"
echo ""
echo "Please visit: https://www.jlbtg.cn"
