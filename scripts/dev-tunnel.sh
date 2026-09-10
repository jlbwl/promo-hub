#!/usr/bin/env bash
# 本地开发环境 SSH 隧道：将阿里云 RDS (3306) 转发到本地 3307
# 用法: ./scripts/dev-tunnel.sh {start|stop|status}
set -euo pipefail

SERVER="root@www.jlbtg.cn"
KEY="$HOME/.ssh/promo_deploy"
RDS_HOST="rm-2ze5472y4r2n6gr19.mysql.rds.aliyuncs.com"
RDS_PORT=3306
LOCAL_PORT=3307

is_running() {
  lsof -i ":$LOCAL_PORT" -sTCP:LISTEN >/dev/null 2>&1
}

case "${1:-status}" in
  start)
    if is_running; then
      echo "隧道已在运行 (本地端口 $LOCAL_PORT)"
      exit 0
    fi
    echo "启动隧道: 本地 $LOCAL_PORT -> $RDS_HOST:$RDS_PORT (via $SERVER)"
    nohup ssh -i "$KEY" -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
      -o ExitOnForwardFailure=yes -N -L "$LOCAL_PORT:$RDS_HOST:$RDS_PORT" "$SERVER" \
      >/tmp/promo-dev-tunnel.log 2>&1 &
    sleep 1
    is_running && echo "隧道已启动 (PID $!)" || { echo "隧道启动失败，查看 /tmp/promo-dev-tunnel.log"; exit 1; }
    ;;
  stop)
    pids=$(lsof -ti ":$LOCAL_PORT" -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$pids" ]; then
      echo "$pids" | xargs kill
      echo "隧道已停止"
    else
      echo "隧道未在运行"
    fi
    ;;
  status)
    if is_running; then
      echo "运行中 (本地端口 $LOCAL_PORT)"
    else
      echo "未运行"
    fi
    ;;
  *)
    echo "用法: $0 {start|stop|status}"
    exit 1
    ;;
esac
