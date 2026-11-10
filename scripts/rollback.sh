#!/usr/bin/env bash
# 生产回滚脚本（在服务器上以 root 执行）
#
# 前置：deploy.yml 的「创建发布快照」步骤会在每次部署前生成
#   $DEPLOY_DIR/releases/<时间戳>_<commit前7位>/
#     ├── REVISION          上一次成功部署的 commit SHA
#     ├── api.env          当时的 .env
#     ├── uploads.tar.gz   当时的 data/uploads
#     ├── api/             API 代码（不含 node_modules / data / .env）
#     ├── admin/ manager/ user/   当时的前端目录
#     └── shared/          当时的 @promo/shared 产物
# 默认只保留最近 3 份。
#
# 用法：
#   bash rollback.sh list             # 列出可用快照
#   bash rollback.sh                  # 回滚到 releases/.last 指向的快照
#   bash rollback.sh 20261110_143000_abc1234
#   DEPLOY_DIR=/www/wwwroot/promo-hub bash rollback.sh
#
# 说明：
#   - 只回滚代码与静态产物，不执行数据库迁移回滚（数据库保持当前 schema）。
#   - .env 只在当前缺失时从快照补回，不会被旧配置覆盖。
#   - node_modules 会按快照内的 package-lock.json 重新安装，需要能访问 npm registry。
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/www/wwwroot/promo-hub}"
RELEASES_DIR="$DEPLOY_DIR/releases"
API_DIR="$DEPLOY_DIR/api"
APP_NAME="${APP_NAME:-promo-api}"
PORT="${PORT:-3000}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmjs.org}"

if [ "${1:-}" = "list" ] || [ "${1:-}" = "--list" ]; then
  echo "可用快照（新 -> 旧）："
  ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null || echo "（无快照）"
  exit 0
fi

if [ ! -d "$API_DIR" ]; then
  echo "❌ 未找到 API 目录：$API_DIR"
  exit 1
fi

if [ -n "${1:-}" ]; then
  case "$1" in
    /*) SNAP="$1" ;;
    *)  SNAP="$RELEASES_DIR/$1" ;;
  esac
else
  SNAP="$(cat "$RELEASES_DIR/.last" 2>/dev/null || true)"
fi

if [ -z "${SNAP:-}" ] || [ ! -d "$SNAP" ]; then
  echo "❌ 快照不存在。请先执行：bash rollback.sh list"
  exit 1
fi

echo "🔙 回滚目标：$SNAP"

# 0) 当前 .env 缺失时，从快照补回
if [ ! -f "$API_DIR/.env" ] && [ -f "$SNAP/api.env" ]; then
  cp -a "$SNAP/api.env" "$API_DIR/.env"
  chmod 600 "$API_DIR/.env"
  echo "✅ 已从快照恢复 .env"
fi

# 1) 恢复 shared（API 通过 node_modules/@promo/shared 软链依赖它）
if [ -d "$SNAP/shared" ]; then
  rm -rf "$DEPLOY_DIR/shared"
  cp -a "$SNAP/shared" "$DEPLOY_DIR/shared"
  echo "✅ 已恢复 shared"
fi

# 2) 恢复三端前端静态目录
for APP in admin manager user; do
  if [ -d "$SNAP/$APP" ]; then
    rm -rf "${DEPLOY_DIR:?}/$APP"
    cp -a "$SNAP/$APP" "$DEPLOY_DIR/$APP"
    echo "✅ 已恢复 $APP"
  fi
done

# 3) 恢复 API 代码（保留 .env / data / node_modules，其余清空后覆盖）
if [ ! -d "$SNAP/api" ]; then
  echo "❌ 快照缺少 api/ 目录，无法回滚代码"
  exit 1
fi
find "$API_DIR" -mindepth 1 -maxdepth 1 \
  ! -name node_modules ! -name data ! -name '.env' -exec rm -rf {} +
cp -a "$SNAP/api/." "$API_DIR/"
echo "✅ 已恢复 API 代码"

# 4) 按快照内的锁定文件重装生产依赖（npm ci 会清空 node_modules）
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
if [ -d "/root/.nvm" ] && [ -f "/root/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  source /root/.nvm/nvm.sh >/dev/null 2>&1 || true
fi
cd "$API_DIR"
if [ -f "package-lock.json" ]; then
  npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_REGISTRY" \
    || npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_REGISTRY" \
    || { echo "❌ 依赖安装失败，回滚中止（API 已停止在旧代码，请人工处理）"; exit 1; }
else
  echo "⚠️ 快照缺少 package-lock.json，降级为 npm install"
  npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_REGISTRY" \
    || { echo "❌ 依赖安装失败，回滚中止"; exit 1; }
fi

# 5) 重建 @promo/shared 链接（npm ci 会清掉非 package.json 声明的包）
mkdir -p "node_modules/@promo"
if [ ! -e "node_modules/@promo/shared" ]; then
  ln -sfn "$DEPLOY_DIR/shared" "node_modules/@promo/shared"
  echo "✅ 已重建 node_modules/@promo/shared"
fi

# 6) 重启 API
PM2_BIN="$(command -v pm2 || true)"
if [ -z "$PM2_BIN" ]; then
  for candidate in /usr/local/bin/pm2 /usr/bin/pm2 /root/.nvm/versions/node/*/bin/pm2; do
    if [ -x "$candidate" ]; then PM2_BIN="$candidate"; break; fi
  done
fi
if [ -z "$PM2_BIN" ]; then
  echo "❌ 未找到 pm2，无法重启 API"
  exit 1
fi

API_ENTRY="dist/index.js"
if [ ! -f "$API_ENTRY" ]; then
  API_ENTRY="index.js"
fi
if [ ! -f "$API_ENTRY" ]; then
  echo "❌ 快照中找不到 API 入口（dist/index.js 或 index.js）"
  exit 1
fi

"$PM2_BIN" delete "$APP_NAME" >/dev/null 2>&1 || true
"$PM2_BIN" start "$API_ENTRY" --name "$APP_NAME" --time
"$PM2_BIN" save >/dev/null 2>&1 || true

# 7) 回写 RELEASE，便于核对线上版本
if [ -f "$SNAP/REVISION" ]; then
  cp "$SNAP/REVISION" "$DEPLOY_DIR/RELEASE"
  echo "📌 RELEASE 已回写为 $(cat "$DEPLOY_DIR/RELEASE")"
fi

# 8) 健康检查
HEALTH_OK=""
for i in $(seq 1 15); do
  sleep 2
  if curl -sf -m 5 "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    HEALTH_OK="yes"
    echo "✅ 健康检查通过（第 ${i} 次探测）"
    break
  fi
  echo "⏳ 第 ${i} 次探测失败，等待重试..."
done
if [ -z "$HEALTH_OK" ]; then
  echo "❌ 回滚后 30 秒内健康检查未通过，请立即人工介入"
  "$PM2_BIN" list || true
  tail -30 /root/.pm2/logs/promo-api-error.log 2>/dev/null || true
  exit 1
fi

echo "🎉 回滚完成：$SNAP"
