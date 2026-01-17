#!/bin/bash
# 修复数据库密码认证问题的脚本

echo "🔧 停止所有服务..."
docker-compose down

echo "🗑️  删除数据库数据卷（这将清除所有数据）..."
docker volume rm team_project_management_postgres_data 2>/dev/null || true

echo "🚀 重新启动服务..."
docker-compose up -d

echo "⏳ 等待数据库启动..."
sleep 10

echo "✅ 修复完成！请查看日志："
echo "   docker logs pm_backend -f"
