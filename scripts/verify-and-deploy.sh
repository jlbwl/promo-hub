#!/bin/bash

echo "============================================"
echo "SSL Certificate Verification & Deployment"
echo "============================================"

CERT_PATH="/etc/nginx/ssl/www.jlbtg.cn.pem"
KEY_PATH="/etc/nginx/ssl/www.jlbtg.cn.key"

# Step 1: Verify certificates exist
echo -e "\n1. Checking certificate files..."
if [ -f "$CERT_PATH" ]; then
    echo "   ✅ Certificate found: $CERT_PATH"
else
    echo "   ❌ Certificate missing: $CERT_PATH"
    exit 1
fi

if [ -f "$KEY_PATH" ]; then
    echo "   ✅ Private key found: $KEY_PATH"
else
    echo "   ❌ Private key missing: $KEY_PATH"
    exit 1
fi

# Step 2: Verify certificate details
echo -e "\n2. Certificate details:"
openssl x509 -in "$CERT_PATH" -text -noout | grep -A 2 -B 2 "Not Before\|Not After"

echo -e "\n3. Certificate domain info:"
openssl x509 -in "$CERT_PATH" -text -noout | grep -A 10 "Subject Alternative Name"

# Step 3: Check certificate and key match
echo -e "\n4. Verifying certificate and key match..."
CERT_MOD=$(openssl x509 -noout -modulus -in "$CERT_PATH" | openssl md5)
KEY_MOD=$(openssl rsa -noout -modulus -in "$KEY_PATH" | openssl md5)

if [ "$CERT_MOD" == "$KEY_MOD" ]; then
    echo "   ✅ Certificate and key match!"
else
    echo "   ❌ Certificate and key DO NOT match!"
    exit 1
fi

# Step 4: Check Nginx configuration
echo -e "\n5. Testing Nginx configuration..."
nginx -t

if [ $? -ne 0 ]; then
    echo "   ❌ Nginx configuration test failed!"
    exit 1
fi

echo "   ✅ Nginx configuration is valid!"

# Step 5: Reload Nginx
echo -e "\n6. Reloading Nginx..."
nginx -s reload

echo -e "\n============================================"
echo "✅ Deployment completed successfully!"
echo "============================================"
echo -e "\nPlease visit: https://www.jlbtg.cn"
