#!/bin/bash

# ============================================================
# 部署状态监控脚本
# 功能：查看最新的 GitHub Actions 部署状态
# ============================================================

REPO_OWNER="jlbwl"
REPO_NAME="promo-hub"

echo "======================================"
echo "      Promo Hub 部署状态检查"
echo "======================================"
echo ""

# 检查 GitHub CLI
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI 未安装"
    echo ""
    echo "请手动查看部署状态："
    echo "https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"
    exit 1
fi

# 获取最新的工作流运行
echo "📋 获取最新的 Deploy to Aliyun Server 工作流运行..."
WORKFLOW_RUNS=$(gh run list --workflow "Deploy to Aliyun Server" --repo "${REPO_OWNER}/${REPO_NAME}" --limit 3 --json id,number,status,conclusion,createdAt,headBranch,event 2>/dev/null)

if [ $? -ne 0 ]; then
    echo "❌ 无法获取工作流状态"
    echo ""
    echo "请手动查看："
    echo "https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"
    exit 1
fi

# 解析 JSON（使用 jq）
if command -v jq &> /dev/null; then
    echo ""
    echo "$WORKFLOW_RUNS" | jq -r '.[] | "工作流 #\(.number)\n  状态: \(.status)\n  结论: \(.conclusion // "运行中")\n  触发: \(.event) 分支: \(.headBranch)\n  时间: \(.createdAt)\n  链接: https://github.com/'"$REPO_OWNER"'/'"$REPO_NAME"'/actions/runs/'"$REPO_OWNER"'\n---"' 2>/dev/null || echo "$WORKFLOW_RUNS"
else
    echo "$WORKFLOW_RUNS"
fi

echo ""
echo "======================================"
echo "📝 查看详细日志："
echo "https://github.com/${REPO_OWNER}/${REPO_NAME}/actions"
echo "======================================"
