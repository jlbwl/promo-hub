#!/usr/bin/env bash
# 生产环境远端部署脚本（由 .github/workflows/deploy.yml 的 deploy job 上传后执行）。
#
# 为什么独立成文件：GitHub Actions 对单个 YAML 标量内的表达式长度上限为 21000 字符，
# 整段脚本内联在 deploy.yml 的 script: 里会导致 workflow 直接解析失败、一个 job 都不创建。
#
# 运行方式：bash <DEPLOY_DIR>/deploy/deploy-remote.sh
# 环境变量（由 ssh-action 的 envs 传入）：
#   DEPLOY_DIR / CERT_DIR / DOMAIN_NAMES / SSL_CERT_PATH / SSL_KEY_PATH / ACME_ROOT / API_URL / GIT_SHA
#   以及写入 .env 用的 DB_* / JWT_SECRET / ALIBABA_* / ALIYUN_OCR_* / REDIS_* / DATA_DIR
# 注意：敏感变量的取值只在本进程环境里存在，写盘后必须 unset（见「3.5」），
#      否则 dotenv 不覆盖已存在变量，会把 CI 的 secret 顶进服务器 .env 的人工配置。

set -e
DEPLOY_DIR="${DEPLOY_DIR:-/www/wwwroot/promo-hub}"
CERT_DIR="${CERT_DIR:-/etc/nginx/ssl}"

echo "=========================================="
echo "⚠️ 注意：本部署仅更新业务代码"
echo "⚠️ 不会覆盖已有的环境配置和 Nginx 配置"
echo "=========================================="

mkdir -p /etc/nginx/conf.d
mkdir -p "$DEPLOY_DIR"
mkdir -p "$CERT_DIR"

# =======================
# 1. 备份已有配置（保护措施）
# =======================
echo "📦 备份已有配置..."
if [ -f "/etc/nginx/conf.d/promo-hub.conf" ]; then
  cp /etc/nginx/conf.d/promo-hub.conf "/etc/nginx/conf.d/promo-hub.conf.backup.$(date +%Y%m%d_%H%M%S)"
  echo "✅ Nginx 配置已备份"
fi

if [ -f "$DEPLOY_DIR/api/.env" ]; then
  cp "$DEPLOY_DIR/api/.env" "$DEPLOY_DIR/api/.env.backup.$(date +%Y%m%d_%H%M%S)"
  echo "✅ .env 配置已备份"
fi

# =======================
# 2. 验证 Shared 目录
# =======================
echo "🔍 检查 Shared 目录..."
cd "$DEPLOY_DIR/shared"
if [ -f "package.json.build" ]; then
  mv package.json.build package.json
  echo "✅ package.json.build -> package.json"
fi
ls -la

# =======================
# 2.5 修复 Shared 目录结构
# =======================
echo "🔍 检查 Shared 目录结构..."
cd "$DEPLOY_DIR/shared"
if [ -d "shared-dist" ]; then
  echo "✅ 找到 shared-dist 目录，正在复制内容..."
  cp -r shared-dist/* ./ 2>&1
  rm -rf shared-dist 2>&1
  echo "✅ shared-dist 内容已复制"
fi
if [ -f "package.json.build" ]; then
  mv package.json.build package.json
  echo "✅ package.json.build -> package.json"
fi
ls -la

# =======================
# 3. 检查并修复 API 目录结构
# =======================
echo "🔍 检查 API 目录内容..."
cd "$DEPLOY_DIR/api"
echo "📁 API 目录内容:"
ls -la

# 如果有 api-dist 子目录，将其内容复制到当前目录
if [ -d "api-dist" ]; then
  echo "✅ 找到 api-dist 子目录，正在展开..."
  cp -r api-dist/* ./ 2>&1
  rm -rf api-dist 2>&1
  echo "✅ api-dist 内容已展开到当前目录"
  echo "📁 展开后的 API 目录内容:"
  ls -la
fi

# =======================
# 2.8 从发布快照恢复 .env 与上传文件（scp rm:true 清空了 api 目录）
# =======================
echo "🔄 从发布快照恢复 .env 与上传文件..."
SNAP="$(cat "$DEPLOY_DIR/releases/.last" 2>/dev/null || true)"
if [ -n "$SNAP" ] && [ -f "$SNAP/api.env" ]; then
  cp -a "$SNAP/api.env" "$DEPLOY_DIR/api/.env"
  chmod 600 "$DEPLOY_DIR/api/.env"
  echo "✅ .env 已从快照恢复"
fi
if [ -n "$SNAP" ] && [ -f "$SNAP/uploads.tar.gz" ]; then
  # 上传目录已迁到 $DEPLOY_DIR/data（发布目录之外）时，scp 覆盖 api 不会再碰到它，
  # 此时恢复快照只会产生一份过期副本，因此跳过；首次迁移那一次仍需要恢复到临时位置再迁移。
  if [ -d "$DEPLOY_DIR/data/uploads" ]; then
    echo "ℹ️ 上传目录已在发布目录之外（$DEPLOY_DIR/data/uploads），跳过快照恢复"
  else
    mkdir -p "$DEPLOY_DIR/api/data"
    tar xzf "$SNAP/uploads.tar.gz" -C "$DEPLOY_DIR/api/data"
    echo "✅ 上传文件已从快照恢复到临时位置（$(find "$DEPLOY_DIR/api/data/uploads" -type f 2>/dev/null | wc -l) 个文件）"
  fi
fi

# =======================
# 2.9 上传目录迁移到发布目录之外（一次性、幂等、不覆盖、不删除源文件）
# 背景：DATA_DIR 曾指向 $DEPLOY_DIR/api/data，而 scp 会整体替换 api 目录，
#       导致部署窗口内的上传文件丢失（收银码上传 500 ENOENT 即由此引发）。
# 新位置：$DEPLOY_DIR/data/uploads（与 api / admin / shared 同级，任何发布步骤都不会删除它）。
# =======================
PERSIST_DATA_DIR="${DATA_DIR:-$DEPLOY_DIR/data}"
case "$PERSIST_DATA_DIR" in
  "$DEPLOY_DIR/api"|"$DEPLOY_DIR/api/"*)
    echo "⚠️ 传入的 DATA_DIR 指向发布目录 api 内（$PERSIST_DATA_DIR），会随部署被覆盖，改用 $DEPLOY_DIR/data"
    PERSIST_DATA_DIR="$DEPLOY_DIR/data" ;;
esac
PERSIST_UPLOAD_DIR="$PERSIST_DATA_DIR/uploads"
LEGACY_UPLOAD_DIR="$DEPLOY_DIR/api/data/uploads"
mkdir -p "$PERSIST_UPLOAD_DIR/covers" "$PERSIST_UPLOAD_DIR/qrcodes"

if [ -d "$LEGACY_UPLOAD_DIR" ]; then
  LEGACY_COUNT=$(find "$LEGACY_UPLOAD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  # -n 不覆盖目标已存在的同名文件，-a 保留时间；源目录保持原样，作为回滚保险
  cp -an "$LEGACY_UPLOAD_DIR/." "$PERSIST_UPLOAD_DIR/" 2>/dev/null || true
  PERSIST_COUNT=$(find "$PERSIST_UPLOAD_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
  echo "✅ 上传目录迁移：旧目录 $LEGACY_COUNT 个文件 / 持久目录 $PERSIST_COUNT 个文件（不覆盖、不删除源文件）"
  if [ "$PERSIST_COUNT" -lt "$LEGACY_COUNT" ]; then
    echo "❌ 迁移后持久目录文件数少于旧目录（$PERSIST_COUNT < $LEGACY_COUNT），中止部署，请人工核对"
    exit 1
  fi
else
  echo "ℹ️ 旧上传目录不存在，跳过迁移（持久目录：$PERSIST_UPLOAD_DIR）"
fi

# =======================
# 3. 检查并创建 .env（仅在不存在时）
# 取值全部来自步骤级 env + ssh-action envs，脚本正文里不出现 secret 表达式。
# =======================
ENV_FILE="$DEPLOY_DIR/api/.env"
if [ -f "$ENV_FILE" ]; then
  echo "🔒 .env 文件已存在，保持原样，不覆盖"
else
  echo "⚠️ .env 文件不存在，创建新的"

  # 生成安全的随机密钥（如果 Secrets 未配置）
  # SESSION_SECRET 已不再被代码使用，仅保留为 JWT_SECRET 的历史回退来源
  GEN_JWT_SECRET="${JWT_SECRET:-}"
  if [ -z "$GEN_JWT_SECRET" ]; then
    GEN_JWT_SECRET="${SESSION_SECRET:-}"
  fi
  if [ -z "$GEN_JWT_SECRET" ]; then
    GEN_JWT_SECRET=$(openssl rand -base64 32)
    echo "🔑 自动生成了 JWT_SECRET"
  fi

  # 可选值统一在这里兜底；空值写成 KEY=（单行、无多余空格），不会产生畸形行
  OPT_REDIS_PORT="${REDIS_PORT:-6379}"
  OPT_REDIS_DB="${REDIS_DB:-0}"
  # 上传目录必须落在发布目录之外（scp 会整体替换 api 目录）
  OPT_DATA_DIR="${DATA_DIR:-$PERSIST_DATA_DIR}"

  # 用 printf 写值：值不经过 shell 二次展开，$ / 反引号 / ! / 空格 / = 都按字面写入。
  # 子 shell 内设 umask 077，文件从创建那一刻起就是 600。
  (
    umask 077
    {
      printf '%s\n' "# 数据库配置"
      printf 'DB_HOST=%s\n' "$DB_HOST"
      printf 'DB_PORT=%s\n' "$DB_PORT"
      printf 'DB_USER=%s\n' "$DB_USER"
      printf 'DB_PASSWORD=%s\n' "$DB_PASSWORD"
      printf 'DB_NAME=%s\n' "$DB_NAME"
      printf '\n'
      printf '%s\n' "# 应用配置"
      printf 'PORT=3000\n'
      printf 'NODE_ENV=production\n'
      printf '\n'
      printf '%s\n' "# 鉴权密钥"
      printf 'JWT_SECRET=%s\n' "$GEN_JWT_SECRET"
      printf '\n'
      printf '%s\n' "# 管理员配置"
      printf 'ADMIN_PHONE=%s\n' "$ADMIN_PHONE"
      printf 'ADMIN_PASSWORD=%s\n' "$ADMIN_PASSWORD"
      printf '\n'
      printf '%s\n' "# 阿里云 SMS 配置"
      printf 'ALIBABA_CLOUD_ACCESS_KEY_ID=%s\n' "$ALIBABA_CLOUD_ACCESS_KEY_ID"
      printf 'ALIBABA_CLOUD_ACCESS_KEY_SECRET=%s\n' "$ALIBABA_CLOUD_ACCESS_KEY_SECRET"
      printf 'ALIBABA_CLOUD_SMS_SIGN_NAME=%s\n' "$ALIBABA_CLOUD_SMS_SIGN_NAME"
      printf 'ALIBABA_CLOUD_SMS_TEMPLATE_CODE=%s\n' "$ALIBABA_CLOUD_SMS_TEMPLATE_CODE"
      printf '\n'
      printf '%s\n' "# 阿里云 OCR 配置（可选，未配置则回退本地识别，不影响启动）"
      printf 'ALIYUN_OCR_ACCESS_KEY_ID=%s\n' "$ALIYUN_OCR_ACCESS_KEY_ID"
      printf 'ALIYUN_OCR_ACCESS_KEY_SECRET=%s\n' "$ALIYUN_OCR_ACCESS_KEY_SECRET"
      printf 'ALIYUN_OCR_ENDPOINT=%s\n' "$ALIYUN_OCR_ENDPOINT"
      printf '\n'
      printf '%s\n' "# Redis 配置（可选，未配置则使用内存缓存）"
      printf 'REDIS_HOST=%s\n' "$REDIS_HOST"
      printf 'REDIS_PORT=%s\n' "$OPT_REDIS_PORT"
      printf 'REDIS_PASSWORD=%s\n' "$REDIS_PASSWORD"
      printf 'REDIS_DB=%s\n' "$OPT_REDIS_DB"
      printf '\n'
      printf '%s\n' "# CORS 配置"
      printf 'CORS_ORIGIN=https://www.jlbtg.cn,https://jlbtg.cn\n'
      printf '\n'
      printf '%s\n' "# 数据目录"
      printf 'DATA_DIR=%s\n' "$OPT_DATA_DIR"
    } > "$ENV_FILE"
  )
  chmod 600 "$ENV_FILE"
  echo "✅ .env 文件已创建（首次部署，权限 600）"
fi

# 新建和从快照恢复两条路径都再收紧一次，避免历史文件残留 644
chmod 600 "$ENV_FILE" 2>/dev/null || true

# =======================
# 3.1 .env 必填项校验（当前只打印，不阻断部署）
# TODO: 观察一个发布周期确认各环境补齐后，把下面的告警分支改为 exit 1，
#       让缺配置在部署阶段暴露，而不是等到健康检查超时才发现。
# =======================
ENV_FILE="$DEPLOY_DIR/api/.env"
MISSING_ENV=""
for KEY in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME PORT JWT_SECRET; do
  VAL=$(grep -E "^${KEY}=" "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d= -f2-)
  if [ -z "$VAL" ]; then
    MISSING_ENV="$MISSING_ENV $KEY"
  fi
done
if [ -n "$MISSING_ENV" ]; then
  echo "⚠️ .env 缺少必填项:${MISSING_ENV}（本轮不阻断部署，补齐后应改为阻断）"
else
  echo "✅ .env 必填项齐全"
fi
for KEY in ALIYUN_OCR_ACCESS_KEY_ID ALIYUN_OCR_ACCESS_KEY_SECRET; do
  VAL=$(grep -E "^${KEY}=" "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d= -f2-)
  if [ -z "$VAL" ]; then
    echo "ℹ️ 未配置 ${KEY}，OCR 将回退本地识别"
  fi
done

# =======================
# 3.2 把 .env 的 DATA_DIR 收敛到持久目录（api 目录之外）
# .env 默认"存在即不覆盖"，但 DATA_DIR 指向 api/data 会被发布覆盖删除，
# 这里只改这一行，改动前再备份一次，其余配置保持原样。
# =======================
CURRENT_DATA_DIR=$(grep -E '^DATA_DIR=' "$ENV_FILE" 2>/dev/null | head -n 1 | cut -d= -f2- || true)
if [ "$CURRENT_DATA_DIR" = "$PERSIST_DATA_DIR" ]; then
  echo "✅ .env 的 DATA_DIR 已是持久目录：$PERSIST_DATA_DIR"
else
  cp -a "$ENV_FILE" "$ENV_FILE.bak.datadir.$(date +%Y%m%d_%H%M%S)"
  if grep -qE '^DATA_DIR=' "$ENV_FILE"; then
    sed -i "s|^DATA_DIR=.*|DATA_DIR=$PERSIST_DATA_DIR|" "$ENV_FILE"
  else
    printf 'DATA_DIR=%s\n' "$PERSIST_DATA_DIR" >> "$ENV_FILE"
  fi
  chmod 600 "$ENV_FILE"
  if ! grep -qxE "DATA_DIR=$PERSIST_DATA_DIR" "$ENV_FILE"; then
    echo "❌ .env 的 DATA_DIR 更新失败，中止部署"
    exit 1
  fi
  echo "✅ .env 的 DATA_DIR 已更新：${CURRENT_DATA_DIR:-<空>} -> $PERSIST_DATA_DIR"
fi

# =======================
# 3.5 创建上传目录
# =======================
echo "📁 创建上传目录..."
# 不 source .env：只按 KEY= 行取值，绝不执行文件内容。
# 同时把 envs 透传进来的 Secret 从本 shell 环境清掉，避免后面的 npm/knex/pm2 子进程
# 因 dotenv 不覆盖已有变量而用 CI 值顶掉服务器 .env 里人工维护的值。
unset DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME \
      JWT_SECRET SESSION_SECRET ADMIN_PHONE ADMIN_PASSWORD \
      ALIBABA_CLOUD_ACCESS_KEY_ID ALIBABA_CLOUD_ACCESS_KEY_SECRET \
      ALIBABA_CLOUD_SMS_SIGN_NAME ALIBABA_CLOUD_SMS_TEMPLATE_CODE \
      ALIYUN_OCR_ACCESS_KEY_ID ALIYUN_OCR_ACCESS_KEY_SECRET ALIYUN_OCR_ENDPOINT \
      REDIS_HOST REDIS_PORT REDIS_PASSWORD REDIS_DB DATA_DIR 2>/dev/null || true
CURRENT_DATA_DIR=$(cat "$ENV_FILE" 2>/dev/null | grep -E '^DATA_DIR=' | head -n 1 | cut -d= -f2- || true)
CURRENT_DATA_DIR="${CURRENT_DATA_DIR:-$PERSIST_DATA_DIR}"
mkdir -p "$CURRENT_DATA_DIR/uploads/covers" "$CURRENT_DATA_DIR/uploads/qrcodes"
echo "✅ 上传目录已创建: $CURRENT_DATA_DIR/uploads"

# =======================
# 3.8 同步 Nginx 的 /uploads 别名到持久目录
# Nginx 已在线的站点配置默认受保护不覆盖，但别名仍指向 api/data/uploads 时，
# 迁移后的图片会 404；这里仅在检测到旧路径时改动，改完先 nginx -t，失败即还原。
# =======================
NGINX_CONF="/etc/nginx/conf.d/promo-hub.conf"
if [ -f "$NGINX_CONF" ]; then
  if grep -qF "alias $LEGACY_UPLOAD_DIR/;" "$NGINX_CONF"; then
    NGINX_BAK="$NGINX_CONF.datadir.$(date +%Y%m%d_%H%M%S)"
    cp -a "$NGINX_CONF" "$NGINX_BAK"
    sed -i "s|alias $LEGACY_UPLOAD_DIR/;|alias $CURRENT_DATA_DIR/uploads/;|g" "$NGINX_CONF"
    if nginx -t >/dev/null 2>&1; then
      echo "✅ Nginx /uploads 别名已切换到：$CURRENT_DATA_DIR/uploads（备份 $NGINX_BAK）"
    else
      cp -a "$NGINX_BAK" "$NGINX_CONF"
      echo "❌ 修改 Nginx 别名后 nginx -t 失败，已还原配置并中止部署"
      exit 1
    fi
  else
    echo "ℹ️ Nginx /uploads 别名无需调整"
  fi
fi

# =======================
# 4. 检查 Nginx 配置（仅在不存在时创建）
# =======================
if [ -f "/etc/nginx/conf.d/promo-hub.conf" ]; then
  echo "🔒 Nginx 配置已存在，保持原样，不覆盖（如需更新请手动操作）"
else
  echo "⚠️ Nginx 配置不存在，使用模板创建（首次部署 / 新机器重建）"
  TEMPLATE="$DEPLOY_DIR/config/nginx.conf.template"
  if [ ! -f "$TEMPLATE" ]; then
    echo "❌ 站点配置与模板同时缺失：$TEMPLATE 不存在，无法创建 Nginx 配置，中止部署"
    exit 1
  fi

  DOMAIN_NAMES="${DOMAIN_NAMES:-www.jlbtg.cn jlbtg.cn}"
  SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/ssl/www.jlbtg.cn.pem}"
  SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/ssl/www.jlbtg.cn.key}"
  ACME_ROOT="${ACME_ROOT:-/var/www/html}"
  API_URL="${API_URL:-http://127.0.0.1:3000/}"
  PROJECT_ROOT="$DEPLOY_DIR"

  for KV in "DOMAIN_NAMES=$DOMAIN_NAMES" "SSL_CERT_PATH=$SSL_CERT_PATH" "SSL_KEY_PATH=$SSL_KEY_PATH" "ACME_ROOT=$ACME_ROOT" "API_URL=$API_URL"; do
    if [ -z "${KV#*=}" ]; then
      echo "❌ 渲染变量为空：${KV%%=*}，无法生成 Nginx 配置，中止部署"
      exit 1
    fi
  done

  # 先渲染到临时文件并校验，校验通过才安装到 conf.d，避免留下半渲染配置
  TMP_CONF="/tmp/promo-hub.conf.$$"
  cp "$TEMPLATE" "$TMP_CONF"
  sed -i "s|\${DOMAIN_NAMES}|$DOMAIN_NAMES|g" "$TMP_CONF"
  sed -i "s|\${SSL_CERT_PATH}|$SSL_CERT_PATH|g" "$TMP_CONF"
  sed -i "s|\${SSL_KEY_PATH}|$SSL_KEY_PATH|g" "$TMP_CONF"
  sed -i "s|\${ACME_ROOT}|$ACME_ROOT|g" "$TMP_CONF"
  sed -i "s|\${API_URL}|$API_URL|g" "$TMP_CONF"
  sed -i "s|\${PROJECT_ROOT}|$PROJECT_ROOT|g" "$TMP_CONF"

  LEFT_OVER=$(grep -oE '[$][{][A-Za-z_]+[}]' "$TMP_CONF" | sort -u | tr '\n' ' ')
  if [ -n "$LEFT_OVER" ]; then
    echo "❌ Nginx 模板渲染失败，仍有未替换占位符：$LEFT_OVER，中止部署"
    rm -f "$TMP_CONF"
    exit 1
  fi
  for SNIPPET in "listen 443" "server_name $DOMAIN_NAMES" "ssl_certificate " "ssl_certificate_key " "location /api/"; do
    if ! grep -qF "$SNIPPET" "$TMP_CONF"; then
      echo "❌ 渲染结果缺少关键片段：$SNIPPET，中止部署"
      rm -f "$TMP_CONF"
      exit 1
    fi
  done

  install -m 644 "$TMP_CONF" /etc/nginx/conf.d/promo-hub.conf
  rm -f "$TMP_CONF"
  echo "✅ Nginx 配置已从模板创建（首次部署）"
fi

# =======================
# 5. 检查 SSL 证书
# =======================
if [ -f "$CERT_DIR/www.jlbtg.cn.pem" ] && [ -f "$CERT_DIR/www.jlbtg.cn.key" ]; then
  echo "✅ SSL证书已存在"
else
  echo "⚠️ SSL证书不存在，使用自签名证书进行测试"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$CERT_DIR/www.jlbtg.cn.key" \
    -out "$CERT_DIR/www.jlbtg.cn.pem" \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=jlbwl/OU=IT/CN=www.jlbtg.cn" 2>/dev/null || true
fi

chmod 600 "$CERT_DIR/www.jlbtg.cn.key" 2>/dev/null || true
chmod 644 "$CERT_DIR/www.jlbtg.cn.pem" 2>/dev/null || true

# =======================
# 6. 安装依赖
# =======================
if [ -f "package.json" ]; then
  echo "✅ package.json已存在（从部署包获取）"
  # 验证 package.json 是否包含必要的依赖
  if ! grep -q "reflect-metadata" package.json; then
    echo "⚠️ package.json 缺少 reflect-metadata，正在添加..."
    npm pkg set dependencies.reflect-metadata="^0.2.2"
  fi
  if ! grep -q "tsyringe" package.json; then
    echo "⚠️ package.json 缺少 tsyringe，正在添加..."
    npm pkg set dependencies.tsyringe="^4.10.0"
  fi
  if ! grep -q "knex" package.json; then
    echo "⚠️ package.json 缺少 knex，正在添加..."
    npm pkg set dependencies.knex="^3.1.0"
  fi
else
  echo "❌ package.json 不存在，创建包含所有依赖的完整版本"
  printf '%s\n' \
    '{"name":"@promo/api","version":"1.0.0","private":true,"type":"module","dependencies":{"@promo/shared":"workspace:*","bcryptjs":"^3.0.3","cookie-parser":"^1.4.7","cors":"^2.8.5","dotenv":"^17.4.2","express":"^4.21.0","express-rate-limit":"^8.5.1","jsonwebtoken":"^9.0.3","knex":"^3.1.0","multer":"^1.4.5-lts.1","mysql2":"^3.22.3","redis":"^5.12.1","reflect-metadata":"^0.2.2","sharp":"^0.33.5","tsyringe":"^4.10.0","uuid":"^11.0.0"},"overrides":{"qs":"^6.16.1","ip-address":"^10.7.4"}}' \
    > package.json
fi

# 非交互 SSH 可能缺少 nvm/homebrew 的 PATH，显式补全
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
if [ -d "/root/.nvm" ] && [ -f "/root/.nvm/nvm.sh" ]; then
  source /root/.nvm/nvm.sh >/dev/null 2>&1 || true
fi

# 可复现安装：优先按 CI 生成的锁定文件精确安装（npm ci 自动清空重建 node_modules）
# 服务器全局 npm 源是 npmmirror，会把 lock 中 registry.npmjs.org 的 resolved 改写成镜像 CDN，
# 镜像同步滞后时个别 tarball 会 404（如 ws@8.22.2），因此这里强制官方源并保留一次降级重试
NPM_OFFICIAL_REGISTRY="https://registry.npmjs.org"
if [ -f "package-lock.json" ]; then
  npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_OFFICIAL_REGISTRY" \
    || npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_OFFICIAL_REGISTRY" \
    || { echo "❌ 依赖安装失败（官方源 npm ci / npm install 均失败），终止部署"; exit 1; }
  echo "✅ 依赖已按锁定文件精确安装（npm ci，官方源，可复现）"
else
  echo "⚠️ 缺少 package-lock.json，降级为 npm install（不可复现）"
  npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --registry="$NPM_OFFICIAL_REGISTRY" || { echo "❌ npm install 失败，终止部署"; exit 1; }
fi
echo "✅ npm依赖已安装（包括 reflect-metadata、tsyringe 和 knex）"
# overrides 需要 npm >= 8.3；打印出来便于从部署日志判断断言失败的原因
echo "ℹ️ 服务器 npm 版本：$(npm -v)（overrides 需 >= 8.3）"

# =======================
# 6.1 sharp 平台二进制自检（原生包漏装会导致 API 启动崩溃循环）
# =======================
echo "🔍 sharp 加载自检..."
if node -e "import('sharp').then(()=>process.exit(0)).catch(()=>process.exit(1))"; then
  echo "✅ sharp 自检通过"
else
  echo "⚠️ sharp 无法加载，补装 linux-x64 平台二进制..."
  npm install --no-save --os=linux --cpu=x64 sharp 2>&1 || true
  node -e "import('sharp').then(()=>console.log('✅ sharp 补装后自检通过')).catch((e)=>{console.error('❌ sharp 仍无法加载:', e.message); process.exit(1);})"
fi

# =======================
# 6.5 执行数据库迁移
# =======================
echo "🔄 执行数据库迁移..."
if [ -f "knexfile.ts" ] && [ -d "migrations" ]; then
  # 先打印迁移清单（只读，失败也不影响部署），便于从日志判断本次是否动了 schema
  npx --yes tsx node_modules/knex/bin/cli.js migrate:list --env production || true
  # knexfile/迁移文件为 TS，通过 tsx 加载执行（缺失则临时下载）
  npx --yes tsx node_modules/knex/bin/cli.js migrate:latest --env production || { echo "❌ 数据库迁移失败，终止部署"; exit 1; }
  echo "✅ 数据库迁移完成"
else
  echo "❌ knexfile.ts 或 migrations 目录缺失，终止部署"
  exit 1
fi

# =======================
# 7. 验证 Shared 包并确保正确部署
# =======================
echo "🔍 检查 @promo/shared 包..."

# npm install 会清掉非 package.json 声明的包（含内联的 @promo/shared），必须重建
# 优先使用符号链接指向 ../shared（与构建产物 package.json 的 exports 一致）
mkdir -p "node_modules/@promo"
if [ ! -e "node_modules/@promo/shared" ]; then
  if [ -d "../shared" ]; then
    ln -sfn "$DEPLOY_DIR/shared" "node_modules/@promo/shared"
    echo "✅ 已建立符号链接 node_modules/@promo/shared -> ../shared"
  elif [ -d "dist/node_modules/@promo/shared" ]; then
    cp -r dist/node_modules/@promo/shared node_modules/@promo/
    echo "✅ 从 dist 复制 @promo/shared 成功"
  else
    echo "❌ 无法找到 @promo/shared 源，终止部署"
    exit 1
  fi
fi

# =======================
# 7.5 关键依赖最终自检（npm install 失败/清包必须在此暴露）
# =======================
echo "🔍 关键依赖加载自检..."
node -e "
  Promise.all([import('@promo/shared'), import('reflect-metadata'), import('tsyringe'), import('sharp'), import('mysql2')])
    .then(() => { console.log('✅ 关键依赖自检通过'); })
    .catch((e) => { console.error('❌ 依赖自检失败:', e.message); process.exit(1); })
"

# =======================
# 7.6 依赖版本断言（只读；overrides 未生效或 npm < 8.3 时在这里暴露）
# =======================
echo "🔍 依赖版本断言（qs / ip-address / sanitize-html 修复下限）..."
ASSERT_ROOT="$DEPLOY_DIR/api" node -e '
  const fs = require("fs");
  const path = require("path");
  const root = process.env.ASSERT_ROOT || process.cwd();
  const floors = {
    "qs": "6.16.1",
    "ip-address": "10.7.4",
    "sanitize-html": "2.18.0",
  };
  const cmp = (a, b) => {
    for (let i = 0; i < 3; i++) {
      const x = a[i] || 0;
      const y = b[i] || 0;
      if (x !== y) return x - y;
    }
    return 0;
  };
  const bad = [];
  for (const [name, floor] of Object.entries(floors)) {
    const p = path.join(root, "node_modules", name, "package.json");
    if (!fs.existsSync(p)) {
      bad.push(name + ": 未安装（要求 >= " + floor + "）");
      continue;
    }
    const actual = JSON.parse(fs.readFileSync(p, "utf8")).version || "0.0.0";
    const a = actual.replace(/^[^0-9]*/, "").split("-")[0].split(".").map(Number);
    const b = floor.split(".").map(Number);
    if (cmp(a, b) < 0) bad.push(name + ": 实际 " + actual + "，要求 >= " + floor);
    else console.log("   ✅ " + name + " " + actual + " >= " + floor);
  }
  if (bad.length) {
    console.error("❌ 依赖版本断言失败（npm overrides 可能未生效，或 npm < 8.3）：");
    bad.forEach((line) => console.error("   - " + line));
    process.exit(1);
  }
  console.log("✅ 依赖版本断言通过");
'

# =======================
# 8. 检查 index.js
# =======================
if [ -f "dist/index.js" ]; then
  echo "✅ dist/index.js 存在"
  API_ENTRY="dist/index.js"
elif [ -f "index.js" ]; then
  echo "✅ index.js 存在"
  API_ENTRY="index.js"
else
  echo "❌ 错误：入口文件不存在！"
  echo "🔍 当前目录内容："
  ls -la
  echo "🔍 dist目录内容（如果存在）："
  ls -la dist 2>/dev/null || true
  exit 1
fi

# =======================
# 9. 验证 Nginx 配置
# =======================
nginx -t || true

# =======================
# 10. 重启 API 服务（找不到 PM2 必须失败，绝不允许静默跳过）
# =======================
PM2_BIN="$(command -v pm2 || true)"
if [ -z "$PM2_BIN" ]; then
  for candidate in /usr/local/bin/pm2 /usr/bin/pm2 /root/.nvm/versions/node/*/bin/pm2; do
    if [ -x "$candidate" ]; then PM2_BIN="$candidate"; break; fi
  done
fi
if [ -n "$PM2_BIN" ]; then
  "$PM2_BIN" delete promo-api 2>/dev/null || true
  "$PM2_BIN" start "$API_ENTRY" --name promo-api --time
  echo "✅ API服务已启动 (入口文件: $API_ENTRY)"
else
  echo "❌ 错误：PM2 不可用，无法重启 API，终止部署"
  exit 1
fi

# =======================
# 10.5 健康检查（重启后必须探测通过，否则判定部署失败）
# =======================
echo "🔍 API 健康检查..."
HEALTH_OK=""
for i in $(seq 1 15); do
  sleep 2
  if curl -sf -m 5 http://127.0.0.1:3000/api/health > /dev/null 2>&1; then
    HEALTH_OK="yes"
    echo "✅ API 健康检查通过（第 ${i} 次探测）"
    break
  fi
  echo "⏳ 第 ${i} 次探测失败，等待重试..."
done
if [ -z "$HEALTH_OK" ]; then
  echo "❌ API 健康检查 30 秒内未通过，部署失败！"
  echo "--- pm2 状态 ---"
  "$PM2_BIN" list || true
  echo "--- 最近错误日志 ---"
  tail -30 /root/.pm2/logs/promo-api-error.log 2>/dev/null || true
  exit 1
fi

# 记录部署版本，便于核对线上运行版本
echo "$GIT_SHA" > "$DEPLOY_DIR/RELEASE"
echo "📌 部署版本: $GIT_SHA"

# =======================
# 11. 重载 Nginx
# =======================
nginx -t && nginx -s reload || true
echo "✅ Nginx已重载"

echo ""
echo "================================================"
echo " 🎉 业务代码部署完成！"
echo "================================================"
echo ""
echo "📋 保护的配置文件："
echo "   - /etc/nginx/conf.d/promo-hub.conf 🔒"
echo "   - $DEPLOY_DIR/api/.env 🔒"
echo ""
echo "💡 如需手动修改配置，请："
echo "   1. SSH 连接到服务器"
echo "   2. 编辑需要修改的配置文件"
echo "   3. 运行 nginx -t && nginx -s reload（如修改 Nginx 配置）"
echo "   4. 运行 pm2 restart promo-api（如修改 .env 配置）"
