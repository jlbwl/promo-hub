#!/bin/bash

# ============================================================
# 自动部署脚本
# 功能：自动触发 GitHub Actions 部署并监控进度
# ============================================================

set -e

# 配置
REPO_OWNER="jlbwl"
REPO_NAME="promo-hub"
GITHUB_TOKEN="${GITHUB_TOKEN:-}"  # 需要设置环境变量或替换为你的 token

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

# 检查 GitHub CLI 是否安装
check_github_cli() {
    if ! command -v gh &> /dev/null; then
        log_error "GitHub CLI 未安装"
        echo "请先安装 GitHub CLI: https://cli.github.com/"
        exit 1
    fi
    log_success "GitHub CLI 已安装"
}

# 检查 GitHub 登录状态
check_github_auth() {
    if ! gh auth status &> /dev/null; then
        log_warning "未登录 GitHub，尝试使用 token 登录..."
        if [ -z "$GITHUB_TOKEN" ]; then
            log_error "请设置 GITHUB_TOKEN 环境变量或手动登录 GitHub CLI"
            echo "手动登录命令: gh auth login"
            exit 1
        fi
        echo "$GITHUB_TOKEN" | gh auth login --with-token
    fi
    log_success "GitHub 认证状态正常"
}

# 触发工作流
trigger_workflow() {
    log_info "触发 Deploy to Aliyun Server 工作流..."
    
    # 使用 workflow_dispatch 触发工作流
    WORKFLOW_RUN=$(gh workflow run "Deploy to Aliyun Server" --repo "${REPO_OWNER}/${REPO_NAME}" --json id,number,title 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        log_success "工作流已触发"
        echo "$WORKFLOW_RUN"
    else
        log_error "触发工作流失败"
        exit 1
    fi
}

# 等待工作流完成
wait_for_workflow() {
    local run_id=$1
    local max_wait=600  # 最多等待10分钟
    local elapsed=0
    local interval=10   # 每10秒检查一次
    
    log_info "等待工作流完成（最多等待 $max_wait 秒）..."
    
    while [ $elapsed -lt $max_wait ]; do
        local status=$(gh run view "$run_id" --repo "${REPO_OWNER}/${REPO_NAME}" --json status --jq '.status')
        local conclusion=$(gh run view "$run_id" --repo "${REPO_OWNER}/${REPO_NAME}" --json conclusion --jq '.conclusion')
        
        echo -ne "\r[${elapsed}s] 状态: $status ${conclusion:+, 结论: $conclusion}    "
        
        if [ "$status" == "completed" ]; then
            echo ""  # 换行
            log_success "工作流已完成"
            return 0
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    echo ""  # 换行
    log_warning "工作流执行超时（等待超过 $max_wait 秒）"
    return 1
}

# 显示工作流结果
show_workflow_result() {
    local run_id=$1
    
    log_info "显示工作流详情..."
    gh run view "$run_id" --repo "${REPO_OWNER}/${REPO_NAME}" --verbose
    
    log_info "显示失败任务的日志..."
    gh run view "$run_id" --repo "${REPO_OWNER}/${REPO_NAME}" --log-failed 2>/dev/null || log_warning "没有失败的日志"
}

# 主函数
main() {
    echo "======================================"
    echo "      Promo Hub 自动部署工具"
    echo "======================================"
    echo ""
    
    # 检查环境
    check_github_cli
    check_github_auth
    
    # 触发工作流
    trigger_workflow
    
    # 提取 run_id（从 JSON 中获取）
    RUN_ID=$(echo "$WORKFLOW_RUN" | jq -r '.[0].id')
    
    if [ -z "$RUN_ID" ] || [ "$RUN_ID" == "null" ]; then
        log_error "无法获取工作流 ID"
        exit 1
    fi
    
    log_success "工作流 ID: $RUN_ID"
    echo ""
    
    # 等待工作流完成
    wait_for_workflow "$RUN_ID"
    
    # 显示结果
    show_workflow_result "$RUN_ID"
    
    echo ""
    echo "======================================"
    log_info "部署任务链接: https://github.com/${REPO_OWNER}/${REPO_NAME}/actions/runs/${RUN_ID}"
    echo "======================================"
}

# 执行主函数
main "$@"
