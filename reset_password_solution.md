# 重置数据库密码完整解决方案（不删除数据）

## 问题

数据库卷已存在，即使修改了 `docker-compose.yml` 中的密码，数据库仍使用旧密码。

## 解决方案：使用信任模式临时修改密码

### 步骤 1：临时修改 docker-compose.yml

在 `db` 服务下添加 `command` 配置，启用信任连接：

```yaml
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
    - postgres_data:/var/lib/postgresql/data
  # ... 其他配置
```

### 步骤 2：重启数据库容器

```bash
docker-compose restart db
```

等待几秒让数据库启动完成。

### 步骤 3：重置密码

```bash
docker exec pm_postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"
```

### 步骤 4：恢复 docker-compose.yml

删除刚才添加的 `command` 配置，恢复原样。

### 步骤 5：重启所有服务

```bash
docker-compose restart
```

## 快速修复脚本

我已经创建了自动化脚本，你可以：

**Windows:**
```powershell
.\reset_postgres_password.ps1
```

**Linux/Mac:**
```bash
chmod +x reset_postgres_password.sh
./reset_postgres_password.sh
```

## 验证

检查后端服务是否正常：

```bash
docker logs pm_backend -f
```

应该不再有密码认证错误。
