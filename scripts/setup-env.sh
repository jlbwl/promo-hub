#!/bin/bash

# ===============================================
# 环境初始化脚本
# 用于快速设置本地开发环境
# ===============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}===============================================${NC}"
echo -e "${BLUE}  Promo-Hub 环境初始化工具${NC}"
echo -e "${BLUE}===============================================${NC}"
echo ""

# 检查是否已经有 .env 文件
check_existing_env() {
    if [ -f "$PROJECT_ROOT/.env" ]; then
        echo -e "${YELLOW}⚠️  检测到已存在 .env 文件${NC}"
        read -p "是否要覆盖？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${GREEN}✅ 跳过环境初始化${NC}"
            exit 0
        fi
    fi
}

# 选择环境
select_environment() {
    echo -e "${BLUE}请选择要初始化的环境：${NC}"
    echo "1) 开发环境 (dev)"
    echo "2) 测试环境 (test)"
    echo "3) 生产环境 (prod)"
    echo ""
    read -p "请输入选项 (1-3，默认 1): " env_choice

    case $env_choice in
        2)
            ENV="test"
            ;;
        3)
            ENV="prod"
            ;;
        *)
            ENV="dev"
            ;;
    esac
}

# 复制环境配置模板
copy_env_templates() {
    echo -e "${GREEN}正在复制 ${ENV} 环境配置模板...${NC}"

    # 复制 API 环境配置
    if [ -f "$PROJECT_ROOT/config/environments/.env.${ENV}.template" ]; then
        cp "$PROJECT_ROOT/config/environments/.env.${ENV}.template" "$PROJECT_ROOT/apps/api/.env"
        echo -e "${GREEN}✅ API 环境配置已创建: apps/api/.env${NC}"
    else
        echo -e "${RED}❌ 找不到 API 环境模板: config/environments/.env.${ENV}.template${NC}"
        exit 1
    fi

    # 复制前端环境配置
    FRONTEND_TEMPLATE="$PROJECT_ROOT/config/environments/.env.frontend.${ENV}.template"
    if [ -f "$FRONTEND_TEMPLATE" ]; then
        for app in admin manager user; do
            cp "$FRONTEND_TEMPLATE" "$PROJECT_ROOT/apps/$app/.env"
            echo -e "${GREEN}✅ ${app} 环境配置已创建: apps/$app/.env${NC}"
        done
    else
        echo -e "${YELLOW}⚠️  找不到前端环境模板: $FRONTEND_TEMPLATE${NC}"
    fi
}

# 显示后续步骤
show_next_steps() {
    echo ""
    echo -e "${BLUE}===============================================${NC}"
    echo -e "${GREEN}✅ 环境初始化完成！${NC}"
    echo -e "${BLUE}===============================================${NC}"
    echo ""
    echo -e "${YELLOW}接下来请执行以下步骤：${NC}"
    echo ""
    echo "1. 编辑环境配置文件，填入真实值："
    echo "   - apps/api/.env"
    echo "   - apps/admin/.env"
    echo "   - apps/manager/.env"
    echo "   - apps/user/.env"
    echo ""
    echo "2. 安装依赖："
    echo "   pnpm install"
    echo ""
    echo "3. 启动开发服务："
    echo "   pnpm dev:admin    # 启动管理后台"
    echo "   pnpm dev:manager  # 启动经理端"
    echo "   pnpm dev:user     # 启动用户端"
    echo ""
}

# 主函数
main() {
    check_existing_env
    select_environment
    copy_env_templates
    show_next_steps
}

main
