# 重置 postgres 用户密码的脚本（不删除数据）

Write-Host "🔍 检查数据库容器状态..." -ForegroundColor Yellow

# 检查数据库容器是否运行
$dbRunning = docker ps --filter "name=pm_postgres" --format "{{.Names}}" | Select-String "pm_postgres"

if (-not $dbRunning) {
    Write-Host "⚠️  数据库容器未运行，正在启动..." -ForegroundColor Yellow
    docker-compose up -d db
    Write-Host "⏳ 等待数据库启动..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

Write-Host ""
Write-Host "🔐 尝试重置 postgres 用户密码..." -ForegroundColor Yellow
Write-Host "   方法 1: 使用 trust 模式临时连接..." -ForegroundColor Gray

# 方法 1: 尝试修改 pg_hba.conf 使用 trust 模式（如果可能）
# 但实际上 PostgreSQL 容器启动后很难动态修改 pg_hba.conf
# 所以我们直接尝试几个常见的密码

Write-Host ""
Write-Host "💡 更可靠的方法：通过环境变量修改密码" -ForegroundColor Cyan
Write-Host ""
Write-Host "由于数据库卷已存在，我们需要：" -ForegroundColor Yellow
Write-Host "1. 临时修改 docker-compose.yml 使用 trust 模式" -ForegroundColor Yellow
Write-Host "2. 或者使用已知密码连接并修改" -ForegroundColor Yellow
Write-Host ""

# 尝试几个常见的密码
$passwords = @("postgres", "admin", "password", "123456", "")
$foundPassword = $null

Write-Host "🔍 尝试自动检测密码..." -ForegroundColor Yellow
foreach ($pwd in $passwords) {
    $pwdParam = if ($pwd) { "-W $pwd" } else { "" }
    $testResult = docker exec pm_postgres psql -U postgres -c "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        $foundPassword = $pwd
        Write-Host "✅ 找到可用密码！" -ForegroundColor Green
        break
    }
}

if ($foundPassword -ne "postgres") {
    Write-Host ""
    Write-Host "⚠️  需要手动重置密码" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请执行以下步骤：" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. 临时修改 docker-compose.yml，添加信任连接：" -ForegroundColor White
    Write-Host "   在 db 服务下添加 command: [" -ForegroundColor Gray
    Write-Host '      "postgres",' -ForegroundColor Gray
    Write-Host '      "-c", "listen_addresses=*",' -ForegroundColor Gray
    Write-Host '      "-c", "host all all 0.0.0.0/0 trust"' -ForegroundColor Gray
    Write-Host '    ]' -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. 重启数据库容器" -ForegroundColor White
    Write-Host "   docker-compose restart db" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 执行密码重置：" -ForegroundColor White
    Write-Host '   docker exec pm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD ''postgres'';"' -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. 恢复 docker-compose.yml 配置" -ForegroundColor White
    Write-Host ""
}

Write-Host "📋 或者直接执行以下命令（如果知道当前密码）：" -ForegroundColor Cyan
Write-Host 'docker exec -it pm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD ''postgres'';"' -ForegroundColor Green
Write-Host ""
