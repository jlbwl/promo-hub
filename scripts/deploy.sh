#!/bin/bash
# ============================================================
# 服务器端部署脚本 — 由 GitHub Actions SSH 调用或手动执行
# 用法: bash deploy.sh [admin|manager|user|all]
# ============================================================

set -e

DEPLOY_DIR="/var/www/promo-hub"
TARGET="${1:-all}"

echo "🚀 开始部署..."

deploy_app() {
    local app=$1
    local source="${DEPLOY_DIR}/dist-${app}"
    local dest="${DEPLOY_DIR}/${app}"

    if [ ! -d "${source}" ]; then
        echo "⚠️  未找到 ${app} 的构建产物: ${source}"
        return 1
    fi

    echo "📦 部署 ${app}..."
    rm -rf "${dest:?}"/*
    cp -r "${source}"/* "${dest}/"
    echo "✅ ${app} 部署完成"
}

case "${TARGET}" in
    admin)
        deploy_app "admin"
        ;;
    manager)
        deploy_app "manager"
        ;;
    user)
        deploy_app "user"
        ;;
    all)
        deploy_app "admin"
        deploy_app "manager"
        deploy_app "user"
        ;;
    *)
        echo "❌ 未知目标: ${TARGET}"
        echo "用法: $0 [admin|manager|user|all]"
        exit 1
        ;;
esac

# 重载 Nginx
echo "🔄 重载 Nginx..."
nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null || true

echo "🎉 部署完成！"
