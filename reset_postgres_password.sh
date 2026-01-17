#!/bin/bash
# 重置 postgres 用户密码的脚本（不删除数据）

echo "🔍 检查数据库容器状态..."

# 检查数据库容器是否运行
if ! docker ps --filter "name=pm_postgres" --format "{{.Names}}" | grep -q "pm_postgres"; then
    echo "⚠️  数据库容器未运行，正在启动..."
    docker-compose up -d db
    echo "⏳ 等待数据库启动..."
    sleep 10
fi

echo ""
echo "💡 直接尝试修改密码..." -ForegroundColor Cyan
echo ""
echo "执行命令修改 postgres 用户密码..." -ForegroundColor Yellow
echo ""

# 尝试直接修改密码（可能需要交互输入当前密码）
echo "如果提示输入密码，请输入你之前使用的密码"
docker exec -it pm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 密码修改成功！" -ForegroundColor Green
    echo "   现在密码已设置为: postgres" -ForegroundColor Green
    echo ""
    echo "🚀 重新启动后端服务..." -ForegroundColor Yellow
    docker-compose restart backend
else
    echo ""
    echo "❌ 密码修改失败，可能需要使用信任模式" -ForegroundColor Red
    echo ""
    echo "请查看下面的详细说明..." -ForegroundColor Yellow
fi
