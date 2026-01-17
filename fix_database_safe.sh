#!/bin/bash
# 安全修复数据库连接问题的脚本（不删除数据）

echo "🔍 检查数据库连接..."

# 检查数据库容器是否运行
if ! docker ps --filter "name=pm_postgres" --format "{{.Names}}" | grep -q "pm_postgres"; then
    echo "⚠️  数据库容器未运行，正在启动..."
    docker-compose up -d db
    
    echo "⏳ 等待数据库启动..."
    sleep 10
fi

echo "🔌 测试数据库连接..."

# 尝试使用 postgres/postgres 连接
if docker exec pm_postgres psql -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; then
    TEST_POSTGRES=success
else
    TEST_POSTGRES=failed
fi

# 尝试使用 galgo/galgo123 连接
if docker exec pm_postgres psql -U galgo -d project_management -c "SELECT 1" > /dev/null 2>&1; then
    TEST_GALGO=success
else
    TEST_GALGO=failed
fi

echo ""
echo "📊 连接测试结果："
echo "   postgres/postgres: $([ "$TEST_POSTGRES" == "success" ] && echo '✅ 成功' || echo '❌ 失败')"
echo "   galgo/galgo123: $([ "$TEST_GALGO" == "success" ] && echo '✅ 成功' || echo '❌ 失败')"
echo ""

if [ "$TEST_POSTGRES" == "success" ]; then
    echo "✅ 数据库连接正常（postgres/postgres）"
    echo "   配置文件已更新为 postgres/postgres"
    echo ""
    echo "🚀 重新启动后端服务..."
    docker-compose restart backend
    
    sleep 5
    echo ""
    echo "📋 查看后端日志："
    echo "   docker logs pm_backend -f --tail 50"
elif [ "$TEST_GALGO" == "success" ]; then
    echo "⚠️  检测到数据库使用 galgo 用户"
    echo "   请将 docker-compose.yml 中的配置改回 galgo/galgo123"
else
    echo "❌ 无法连接到数据库"
    echo "   请检查："
    echo "   1. 数据库容器是否正常运行"
    echo "   2. 数据库的用户名和密码是否正确"
fi
