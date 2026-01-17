# 安全修复数据库连接问题的 PowerShell 脚本（不删除数据）

Write-Host "🔍 检查数据库连接..." -ForegroundColor Yellow

# 检查数据库容器是否运行
$dbRunning = docker ps --filter "name=pm_postgres" --format "{{.Names}}" | Select-String "pm_postgres"

if (-not $dbRunning) {
    Write-Host "⚠️  数据库容器未运行，正在启动..." -ForegroundColor Yellow
    docker-compose up -d db
    
    Write-Host "⏳ 等待数据库启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host "🔌 测试数据库连接..." -ForegroundColor Yellow

# 尝试使用 postgres/postgres 连接
$testPostgres = docker exec pm_postgres psql -U postgres -d postgres -c "SELECT 1" 2>&1
$testPostgresSuccess = $LASTEXITCODE -eq 0

# 尝试使用 galgo/galgo123 连接
$testGalgo = docker exec pm_postgres psql -U galgo -d project_management -c "SELECT 1" 2>&1
$testGalgoSuccess = $LASTEXITCODE -eq 0

Write-Host ""
Write-Host "📊 连接测试结果：" -ForegroundColor Cyan
Write-Host "   postgres/postgres: $(if ($testPostgresSuccess) { '✅ 成功' } else { '❌ 失败' })"
Write-Host "   galgo/galgo123: $(if ($testGalgoSuccess) { '✅ 成功' } else { '❌ 失败' })"
Write-Host ""

if ($testPostgresSuccess) {
    Write-Host "✅ 数据库连接正常（postgres/postgres）" -ForegroundColor Green
    Write-Host "   配置文件已更新为 postgres/postgres" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 重新启动后端服务..." -ForegroundColor Yellow
    docker-compose restart backend
    
    Start-Sleep -Seconds 5
    Write-Host ""
    Write-Host "📋 查看后端日志：" -ForegroundColor Cyan
    Write-Host "   docker logs pm_backend -f --tail 50" -ForegroundColor Gray
} elseif ($testGalgoSuccess) {
    Write-Host "⚠️  检测到数据库使用 galgo 用户" -ForegroundColor Yellow
    Write-Host "   请将 docker-compose.yml 中的配置改回 galgo/galgo123" -ForegroundColor Yellow
} else {
    Write-Host "❌ 无法连接到数据库" -ForegroundColor Red
    Write-Host "   请检查：" -ForegroundColor Yellow
    Write-Host "   1. 数据库容器是否正常运行" -ForegroundColor Yellow
    Write-Host "   2. 数据库的用户名和密码是否正确" -ForegroundColor Yellow
}
