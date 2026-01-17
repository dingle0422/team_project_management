# 数据库密码认证问题修复指南

## 问题原因

PostgreSQL 数据库容器在首次启动时会使用 `POSTGRES_USER` 和 `POSTGRES_PASSWORD` 环境变量设置用户名和密码。
如果数据库数据卷（volume）已经存在，即使修改了 `docker-compose.yml` 中的配置，
数据库仍然会使用旧的用户名和密码，导致认证失败。

**常见情况：**
- 之前使用 `postgres/postgres` 创建了数据库
- 现在配置改成了 `galgo/galgo123`
- 后端连接时使用新配置，但数据库里还是旧用户，导致认证失败

## 解决方案

### 方法 1：同步配置（推荐，不丢失数据）⭐

如果你的数据库之前使用的是 `postgres/postgres`，最简单的办法是将 `docker-compose.yml` 改回相同的配置。

**已自动修改配置为 `postgres/postgres`，请重新启动服务：**

```bash
docker-compose restart backend
```

或者使用安全修复脚本（会自动检测并验证）：
```powershell
# Windows
.\fix_database_safe.ps1

# Linux/Mac
chmod +x fix_database_safe.sh
./fix_database_safe.sh
```

### 方法 2：使用修复脚本（会删除数据）⚠️

**Windows (PowerShell):**
```powershell
.\fix_database.ps1
```

**Linux/Mac:**
```bash
chmod +x fix_database.sh
./fix_database.sh
```

### 方法 3：手动执行命令（会删除数据）⚠️

**步骤 1：停止所有服务**
```bash
docker-compose down
```

**步骤 2：删除数据库数据卷**
```bash
# 注意：这会删除所有数据库数据！
docker volume rm team_project_management_postgres_data
```

**步骤 3：重新启动服务**
```bash
docker-compose up -d
```

**步骤 4：查看后端日志确认**
```bash
docker logs pm_backend -f
```

## 验证配置

确认 `docker-compose.yml` 中的配置：

- 数据库用户：`${DB_USER:-galgo}` （默认：galgo）
- 数据库密码：`${DB_PASSWORD:-galgo123}` （默认：galgo123）
- 数据库名称：`${DB_NAME:-project_management}` （默认：project_management）

如果需要在生产环境使用不同的密码，请在项目根目录创建 `.env` 文件：

```env
DB_USER=your_user
DB_PASSWORD=your_secure_password
DB_NAME=project_management
```

## 注意事项

⚠️ **警告：删除数据库卷会清除所有数据！**

如果数据库中有重要数据，请先备份：
```bash
# 备份数据库
docker exec pm_postgres pg_dump -U galgo project_management > backup.sql

# 恢复数据库（修复后）
docker exec -i pm_postgres psql -U galgo project_management < backup.sql
```
