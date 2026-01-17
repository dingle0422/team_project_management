# 修复数据库密码认证问题的 PowerShell 脚本

Write-Host "🔧 停止所有服务..." -ForegroundColor Yellow
docker-compose down

Write-Host "🗑️  删除数据库数据卷（这将清除所有数据）..." -ForegroundColor Yellow
docker volume rm team_project_management_postgres_data 2>$null

Write-Host "🚀 重新启动服务..." -ForegroundColor Green
docker-compose up -d

Write-Host "⏳ 等待数据库启动..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "✅ 修复完成！请查看日志：" -ForegroundColor Green
Write-Host "   docker logs pm_backend -f" -ForegroundColor Cyan
