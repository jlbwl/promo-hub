# ===============================================
# 环境初始化脚本 (PowerShell 版本)
# 用于快速设置本地开发环境
# ===============================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  Promo-Hub 环境初始化工具" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否已经有 .env 文件
function Check-ExistingEnv {
    if (Test-Path "$ProjectRoot\.env") {
        Write-Host "⚠️  检测到已存在 .env 文件" -ForegroundColor Yellow
        $response = Read-Host "是否要覆盖？(y/N)"
        if ($response -ne "y" -and $response -ne "Y") {
            Write-Host "✅ 跳过环境初始化" -ForegroundColor Green
            exit 0
        }
    }
}

# 选择环境
function Select-Environment {
    Write-Host "请选择要初始化的环境：" -ForegroundColor Cyan
    Write-Host "1) 开发环境 (dev)"
    Write-Host "2) 测试环境 (test)"
    Write-Host "3) 生产环境 (prod)"
    Write-Host ""
    $envChoice = Read-Host "请输入选项 (1-3，默认 1)"

    switch ($envChoice) {
        "2" { $global:Env = "test" }
        "3" { $global:Env = "prod" }
        default { $global:Env = "dev" }
    }
}

# 复制环境配置模板
function Copy-EnvTemplates {
    Write-Host "正在复制 $Env 环境配置模板..." -ForegroundColor Green

    # 复制 API 环境配置
    $apiTemplate = "$ProjectRoot\config\environments\.env.$Env.template"
    if (Test-Path $apiTemplate) {
        Copy-Item $apiTemplate "$ProjectRoot\apps\api\.env" -Force
        Write-Host "✅ API 环境配置已创建: apps\api\.env" -ForegroundColor Green
    } else {
        Write-Host "❌ 找不到 API 环境模板: $apiTemplate" -ForegroundColor Red
        exit 1
    }

    # 复制前端环境配置
    $frontendTemplate = "$ProjectRoot\config\environments\.env.frontend.$Env.template"
    if (Test-Path $frontendTemplate) {
        foreach ($app in @("admin", "manager", "user")) {
            Copy-Item $frontendTemplate "$ProjectRoot\apps\$app\.env" -Force
            Write-Host "✅ ${app} 环境配置已创建: apps\$app\.env" -ForegroundColor Green
        }
    } else {
        Write-Host "⚠️  找不到前端环境模板: $frontendTemplate" -ForegroundColor Yellow
    }
}

# 显示后续步骤
function Show-NextSteps {
    Write-Host ""
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host "✅ 环境初始化完成！" -ForegroundColor Green
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "接下来请执行以下步骤：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 编辑环境配置文件，填入真实值："
    Write-Host "   - apps\api\.env"
    Write-Host "   - apps\admin\.env"
    Write-Host "   - apps\manager\.env"
    Write-Host "   - apps\user\.env"
    Write-Host ""
    Write-Host "2. 安装依赖："
    Write-Host "   pnpm install"
    Write-Host ""
    Write-Host "3. 启动开发服务："
    Write-Host "   pnpm dev:admin    # 启动管理后台"
    Write-Host "   pnpm dev:manager  # 启动经理端"
    Write-Host "   pnpm dev:user     # 启动用户端"
    Write-Host ""
}

# 主函数
Check-ExistingEnv
Select-Environment
Copy-EnvTemplates
Show-NextSteps
