#!/bin/bash
# 手动部署脚本 - 用于触发 GitHub Actions 部署
# 使用方法: 在本地运行此脚本，它会强制重新推送代码触发部署

set -e

echo "================================================"
echo " 🎯 手动触发 GitHub Actions 部署"
echo "================================================"

cd "$(dirname "$0")/.."

# 检查 git 状态
echo "📋 检查 Git 状态..."
if [ -n "$(git status --porcelain)" ]; then
  echo "⚠️  有未提交的更改，先提交..."
  git add -A
  git commit -m "chore: 手动触发部署 $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 强制推送到远程触发 Actions
echo "🚀 推送到远程仓库触发部署..."
git push origin main --force-with-lease

echo ""
echo "================================================"
echo " ✅ 部署已触发！"
echo "================================================"
echo ""
echo "请在 GitHub 仓库中查看 Actions 进度："
echo "  → https://github.com/jlbwl/promo-hub/actions"
echo ""
echo "💡 提示："
echo "  - 如果 GitHub Actions 未启用，请手动在仓库 Settings → Actions 中启用"
echo "  - 如果想手动触发，可以点击 'Run workflow' 按钮"
echo ""
