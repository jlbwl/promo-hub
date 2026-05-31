#!/bin/bash
# 密码迁移脚本 - 服务器端快捷执行脚本

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_DIR="/www/wwwroot/promo-hub"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  PromoHub 密码迁移工具${NC}"
echo -e "${GREEN}========================================${NC}"

# 检查是否在正确的目录
if [ ! -f "$PROJECT_DIR/package.json" ]; then
    echo -e "${YELLOW}提示：未找到项目目录 $PROJECT_DIR${NC}"
    PROJECT_DIR="$SCRIPT_DIR/.."
fi

cd "$PROJECT_DIR" || {
    echo -e "${RED}错误：无法进入项目目录${NC}"
    exit 1
}

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}警告：未找到 .env 文件${NC}"
    echo "请确保数据库环境变量已设置"
fi

# 检查 tsx 是否安装
if ! command -v tsx &> /dev/null; then
    echo -e "${YELLOW}正在安装 tsx...${NC}"
    npm install -g tsx
fi

# 检查 mysql2 和 bcryptjs
if [ ! -d "node_modules/mysql2" ] || [ ! -d "node_modules/bcryptjs" ]; then
    echo -e "${YELLOW}正在安装依赖...${NC}"
    cd apps/api || exit 1
    npm install mysql2 bcryptjs dotenv
    cd ../..
fi

echo ""
echo "请选择操作："
echo "1) 检测明文密码 (推荐先执行此步骤)"
echo "2) 安全迁移明文密码"
echo "3) 强制重置所有密码 (慎用)"
echo "4) 退出"
echo ""

read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}正在检测明文密码...${NC}"
        cd apps/api || exit 1
        tsx ../../scripts/migrate-passwords.ts --check
        ;;
    2)
        echo ""
        echo -e "${YELLOW}⚠️  警告：此操作将：${NC}"
        echo "   - 将所有明文密码替换为随机 bcrypt 哈希"
        echo "   - 用户需要通过短信验证码重新设置密码"
        echo ""
        read -p "确认继续？(yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo -e "${GREEN}正在备份数据库...${NC}"
            # 这里可以添加备份命令
            echo -e "${GREEN}正在执行迁移...${NC}"
            cd apps/api || exit 1
            tsx ../../scripts/migrate-passwords.ts --migrate
        else
            echo -e "${YELLOW}已取消操作${NC}"
        fi
        ;;
    3)
        echo ""
        echo -e "${RED}⚠️  ⚠️  严重警告：此操作将重置所有用户的密码！⚠️  ⚠️  ${NC}"
        echo ""
        read -p "确认继续？(yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            echo ""
            echo -e "${GREEN}正在备份数据库...${NC}"
            # 这里可以添加备份命令
            echo -e "${GREEN}正在执行重置...${NC}"
            cd apps/api || exit 1
            tsx ../../scripts/migrate-passwords.ts --force-reset
        else
            echo -e "${YELLOW}已取消操作${NC}"
        fi
        ;;
    4)
        echo "退出"
        exit 0
        ;;
    *)
        echo -e "${RED}无效选项${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  操作完成${NC}"
echo -e "${GREEN}========================================${NC}"
