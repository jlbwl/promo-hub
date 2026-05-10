# ============================================================
# Promo Hub 自动化部署脚本
# 功能：构建、部署、回滚、监控
# 用法：
#   bash deploy.sh build      # 构建所有应用
#   bash deploy.sh deploy    # 部署到服务器
#   bash deploy.sh rollback  # 回滚到上一版本
#   bash deploy.sh all       # 构建并部署
#   bash deploy.sh status    # 查看服务状态
#   bash deploy.sh logs      # 查看日志
# ============================================================

set -e

# 配置
DEPLOY_DIR="/www/wwwroot/promo-hub"
BACKUP_DIR="/www/wwwroot/promo-hub/backups"
LOG_DIR="/www/wwwroot/promo-hub/logs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 未安装，请先安装"
        exit 1
    fi
}

# 创建必要目录
create_directories() {
    log_info "创建部署目录..."
    mkdir -p "${DEPLOY_DIR}"/{admin,manager,user,api,backups,logs}
    mkdir -p "${DEPLOY_DIR}/api/data/uploads"
    log_success "目录创建完成"
}

# 备份函数
backup() {
    local app=$1
    log_info "备份 ${app}..."
    
    local backup_file="${BACKUP_DIR}/${app}_${TIMESTAMP}.tar.gz"
    if [ -d "${DEPLOY_DIR}/${app}" ] && [ "$(ls -A ${DEPLOY_DIR}/${app} 2>/dev/null)" ]; then
        tar -czf "${backup_file}" -C "${DEPLOY_DIR}" "${app}"
        log_success "备份已保存: ${backup_file}"
        
        # 只保留最近5个备份
        ls -t "${BACKUP_DIR}"/${app}_*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -f
    else
        log_warning "${app} 目录为空或不存在，跳过备份"
    fi
}

# 备份所有应用
backup_all() {
    log_info "开始备份所有应用..."
    backup "admin"
    backup "manager"
    backup "user"
    backup "api"
}

# 构建函数
build_app() {
    local app=$1
    log_info "构建 ${app}..."
    
    case "${app}" in
        admin)
            pnpm --filter @promo/admin build
            ;;
        manager)
            pnpm --filter @promo/manager build
            ;;
        user)
            pnpm --filter @promo/user build
            ;;
        api)
            pnpm --filter @promo/api build
            ;;
        *)
            log_error "未知应用: ${app}"
            return 1
            ;;
    esac
    
    log_success "${app} 构建完成"
}

# 部署单个应用
deploy_app() {
    local app=$1
    log_info "部署 ${app}..."
    
    local source=""
    case "${app}" in
        admin)
            source="apps/admin/dist"
            ;;
        manager)
            source="apps/manager/dist"
            ;;
        user)
            source="apps/user/dist"
            ;;
        api)
            source="apps/api/dist"
            ;;
        *)
            log_error "未知应用: ${app}"
            return 1
            ;;
    esac
    
    if [ ! -d "${source}" ]; then
        log_error "构建产物不存在: ${source}"
        return 1
    fi
    
    # 备份旧版本
    if [ "${app}" != "api" ]; then
        backup "${app}"
    fi
    
    # 部署
    rm -rf "${DEPLOY_DIR:?}/${app:?}"/*
    cp -r "${source}"/* "${DEPLOY_DIR}/${app}/"
    
    # 设置权限
    chown -R nginx:nginx "${DEPLOY_DIR}/${app}"
    
    log_success "${app} 部署完成"
}

# 重启API服务
restart_api() {
    log_info "重启 API 服务..."
    
    # 检查 PM2 是否安装
    if ! command -v pm2 &> /dev/null; then
        log_warning "PM2 未安装，使用 node 直接启动"
        # 杀掉旧进程
        pkill -f "node.*apps/api" || true
        # 启动新进程
        cd "${DEPLOY_DIR}/api"
        nohup node dist/index.js > "${LOG_DIR}/api_${TIMESTAMP}.log" 2>&1 &
        sleep 2
        log_success "API 服务已启动"
    else
        # 使用 PM2 管理
        cd "${DEPLOY_DIR}/api"
        pm2 delete promo-api 2>/dev/null || true
        pm2 start dist/index.js --name promo-api -l "${LOG_DIR}/api.log" --wait-ready --listen-timeout 10000
        pm2 save
        log_success "API 服务已重启"
    fi
}

# 重载 Nginx
reload_nginx() {
    log_info "重载 Nginx..."
    nginx -t && nginx -s reload
    log_success "Nginx 已重载"
}

# 查看服务状态
show_status() {
    echo ""
    echo "======================================"
    echo "           服务状态报告"
    echo "======================================"
    echo ""
    
    echo "📊 前端应用:"
    echo "  Admin:   ${DEPLOY_DIR}/admin"
    echo "  Manager: ${DEPLOY_DIR}/manager"
    echo "  User:    ${DEPLOY_DIR}/user"
    echo ""
    
    echo "🔧 API 服务:"
    if command -v pm2 &> /dev/null; then
        pm2 status
    else
        if pgrep -f "node.*apps/api" > /dev/null; then
            echo "  状态: 运行中 (PID: $(pgrep -f 'node.*apps/api' | head -1))"
        else
            echo "  状态: 未运行"
        fi
    fi
    echo ""
    
    echo "💾 备份文件:"
    if [ -d "${BACKUP_DIR}" ]; then
        ls -lh "${BACKUP_DIR}" | tail -n +2 | head -5
    else
        echo "  无备份"
    fi
    echo ""
    
    echo "📝 最近日志:"
    if [ -f "${LOG_DIR}/api.log" ]; then
        tail -n 5 "${LOG_DIR}/api.log"
    else
        echo "  无日志文件"
    fi
    echo ""
}

# 查看日志
show_logs() {
    local lines=${1:-50}
    
    echo "======================================"
    echo "         API 服务日志 (最近 ${lines} 行)"
    echo "======================================"
    echo ""
    
    if [ -f "${LOG_DIR}/api.log" ]; then
        tail -n "${lines}" "${LOG_DIR}/api.log"
    elif command -v pm2 &> /dev/null; then
        pm2 logs promo-api --lines "${lines}" --nostream
    else
        log_warning "未找到日志文件"
    fi
}

# 回滚函数
rollback() {
    local app=${1:-all}
    log_warning "回滚操作将用备份替换当前版本"
    
    if [ "${app}" = "all" ]; then
        for app_name in admin manager user api; do
            rollback_single "${app_name}"
        done
    else
        rollback_single "${app}"
    fi
    
    restart_api
    reload_nginx
    log_success "回滚完成"
}

rollback_single() {
    local app=$1
    log_info "回滚 ${app}..."
    
    # 找到最新的备份
    local backup_file=$(ls -t "${BACKUP_DIR}"/${app}_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "${backup_file}" ]; then
        log_error "未找到 ${app} 的备份"
        return 1
    fi
    
    log_warning "使用备份: ${backup_file}"
    
    # 解压备份
    tar -xzf "${backup_file}" -C "${DEPLOY_DIR}"
    
    log_success "${app} 回滚完成"
}

# 健康检查
health_check() {
    local retries=3
    local delay=2
    
    echo "执行健康检查..."
    
    for i in $(seq 1 ${retries}); do
        log_info "尝试 ${i}/${retries}..."
        
        # 检查 API 健康状态
        if curl -sf http://127.0.0.1:3000/api/health > /dev/null; then
            log_success "API 服务健康检查通过"
            return 0
        fi
        
        if [ ${i} -lt ${retries} ]; then
            sleep ${delay}
        fi
    done
    
    log_error "API 服务健康检查失败"
    return 1
}

# 主函数
main() {
    local command=${1:-help}
    
    # 检查必要命令
    check_command "node"
    check_command "pnpm"
    check_command "tar"
    
    # 创建目录
    create_directories
    
    case "${command}" in
        build)
            log_info "开始构建所有应用..."
            build_app "admin"
            build_app "manager"
            build_app "user"
            build_app "api"
            log_success "所有应用构建完成"
            ;;
            
        deploy)
            log_info "开始部署..."
            deploy_app "admin"
            deploy_app "manager"
            deploy_app "user"
            deploy_app "api"
            restart_api
            reload_nginx
            health_check
            log_success "部署完成"
            ;;
            
        all|full)
            log_info "构建并部署所有应用..."
            build_app "admin"
            build_app "manager"
            build_app "user"
            build_app "api"
            backup_all
            deploy_app "admin"
            deploy_app "manager"
            deploy_app "user"
            deploy_app "api"
            restart_api
            reload_nginx
            health_check
            log_success "构建并部署完成"
            ;;
            
        rollback)
            rollback "${2:-all}"
            ;;
            
        status)
            show_status
            ;;
            
        logs)
            show_logs "${2:-50}"
            ;;
            
        restart)
            log_info "重启服务..."
            restart_api
            reload_nginx
            health_check
            log_success "重启完成"
            ;;
            
        backup)
            backup_all
            log_success "备份完成"
            ;;
            
        help|--help|-h)
            echo ""
            echo "Promo Hub 部署脚本"
            echo ""
            echo "用法: bash deploy.sh <command>"
            echo ""
            echo "命令:"
            echo "  build      构建所有应用"
            echo "  deploy     部署到服务器"
            echo "  all        构建并部署"
            echo "  rollback   回滚到上一版本"
            echo "  status     查看服务状态"
            echo "  logs       查看日志"
            echo "  restart    重启服务"
            echo "  backup     备份所有应用"
            echo "  help       显示帮助信息"
            echo ""
            ;;
            
        *)
            log_error "未知命令: ${command}"
            echo "使用 'bash deploy.sh help' 查看帮助"
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
