# 完整修复数据库密码的脚本（不删除数据）

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "数据库密码重置脚本" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# 步骤 1: 使用信任模式启动数据库
Write-Host "步骤 1/5: 使用信任模式重启数据库..." -ForegroundColor Yellow

# 临时添加 command 配置到 docker-compose.yml
Write-Host "   备份原配置..." -ForegroundColor Gray
Copy-Item docker-compose.yml docker-compose.yml.backup -ErrorAction SilentlyContinue

# 读取 docker-compose.yml
$content = Get-Content docker-compose.yml -Raw

# 检查是否已有 command
if ($content -notmatch 'command:\s*\n') {
    # 在 db 服务的 volumes 前添加 command
    $content = $content -replace '(db:\s*\n.*?volumes:)', @'
db:
    image: postgres:15-alpine
    container_name: pm_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-project_management}
    command:
      - "postgres"
      - "-c"
      - "listen_addresses=*"
      - "-c"
      - "host all all 0.0.0.0/0 trust"
    volumes:
'@
    
    # 先简化：直接使用信任模式文件
    Write-Host "   使用 docker-compose.trust.yml 重启..." -ForegroundColor Gray
    
    if (Test-Path docker-compose.trust.yml) {
        docker-compose -f docker-compose.trust.yml up -d db
        Start-Sleep -Seconds 5
        
        Write-Host "✅ 数据库已用信任模式启动" -ForegroundColor Green
        
        # 步骤 2: 重置密码
        Write-Host ""
        Write-Host "步骤 2/5: 重置 postgres 用户密码..." -ForegroundColor Yellow
        docker exec pm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ 密码已重置为: postgres" -ForegroundColor Green
            
            # 步骤 3: 恢复原配置
            Write-Host ""
            Write-Host "步骤 3/5: 恢复原配置..." -ForegroundColor Yellow
            docker-compose -f docker-compose.yml up -d db
            Start-Sleep -Seconds 5
            
            # 步骤 4: 重启后端
            Write-Host ""
            Write-Host "步骤 4/5: 重启后端服务..." -ForegroundColor Yellow
            docker-compose restart backend
            Start-Sleep -Seconds 3
            
            # 步骤 5: 验证
            Write-Host ""
            Write-Host "步骤 5/5: 验证连接..." -ForegroundColor Yellow
            $testResult = docker exec pm_postgres psql -U postgres -d postgres -c "SELECT 1;" 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "=========================================" -ForegroundColor Green
                Write-Host "✅ 修复完成！" -ForegroundColor Green
                Write-Host "=========================================" -ForegroundColor Green
                Write-Host ""
                Write-Host "📋 查看后端日志：" -ForegroundColor Cyan
                Write-Host "   docker logs pm_backend -f --tail 50" -ForegroundColor Gray
            } else {
                Write-Host "⚠️  验证失败，请手动检查" -ForegroundColor Yellow
            }
        } else {
            Write-Host "❌ 密码重置失败" -ForegroundColor Red
        }
    } else {
        Write-Host "❌ 找不到 docker-compose.trust.yml" -ForegroundColor Red
    }
} else {
    Write-Host "   配置已包含 command，跳过..." -ForegroundColor Gray
}

Write-Host ""
