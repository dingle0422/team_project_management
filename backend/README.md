# 算法团队项目管理系统 - 后端

基于 FastAPI 构建的项目管理系统后端服务。

## 技术栈

- **框架**: FastAPI
- **ORM**: SQLAlchemy 2.0
- **数据库**: PostgreSQL
- **认证**: JWT (python-jose)
- **密码加密**: passlib + bcrypt
- **AI服务**: OpenAI API (可选)

## 项目结构

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py          # 依赖注入
│   │   └── v1/
│   │       ├── api.py       # 路由聚合
│   │       └── endpoints/   # API端点
│   │           ├── auth.py      # 认证
│   │           ├── members.py   # 成员管理
│   │           ├── projects.py  # 项目管理
│   │           └── meetings.py  # 会议纪要
│   ├── core/
│   │   ├── config.py        # 配置
│   │   ├── database.py      # 数据库
│   │   └── security.py      # 安全
│   ├── models/              # SQLAlchemy模型
│   ├── schemas/             # Pydantic模型
│   ├── services/            # 业务逻辑
│   └── main.py              # 应用入口
├── scripts/
│   └── init_db.py           # 数据库初始化
├── requirements.txt
└── env.template             # 环境变量模板
```

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 配置环境变量

复制 `env.template` 为 `.env` 并修改配置：

```bash
cp env.template .env
```

主要配置项：
- `DATABASE_URL`: PostgreSQL 连接字符串
- `SECRET_KEY`: JWT 密钥（生产环境请修改）
- `OPENAI_API_KEY`: OpenAI API密钥（可选，用于AI周报功能）

### 3. 创建数据库

确保 PostgreSQL 已运行，创建数据库：

```sql
CREATE DATABASE project_management;
```

### 4. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 5. 访问API文档

- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

## API概览

### 认证 `/api/v1/auth`
- `POST /register` - 注册
- `POST /login` - 登录
- `GET /me` - 获取当前用户
- `POST /change-password` - 修改密码

### 成员管理 `/api/v1/members`
- `GET /` - 成员列表（分页）
- `GET /all` - 所有成员（下拉选择用）
- `GET /{id}` - 成员详情
- `POST /` - 创建成员（管理员）
- `PUT /{id}` - 更新成员
- `PATCH /{id}/status` - 更新状态（管理员）
- `DELETE /{id}` - 删除成员（管理员）

### 项目管理 `/api/v1/projects`
- `GET /` - 项目列表
- `GET /all` - 所有项目（下拉选择用）
- `GET /{id}` - 项目详情
- `POST /` - 创建项目
- `PUT /{id}` - 更新项目
- `DELETE /{id}` - 删除项目
- `GET /{id}/members` - 项目成员列表
- `POST /{id}/members` - 添加项目成员
- `DELETE /{id}/members/{member_id}` - 移除项目成员

### 会议纪要 `/api/v1/meetings`
- `GET /` - 会议列表
- `GET /by-project/{project_id}` - 项目会议列表
- `GET /{id}` - 会议详情
- `POST /` - 创建会议纪要
- `PUT /{id}` - 更新会议纪要
- `DELETE /{id}` - 删除会议纪要

### 任务管理 `/api/v1/tasks`
- `GET /` - 任务列表（支持筛选、搜索）
- `GET /by-project/{project_id}` - 项目任务（看板视图）
- `GET /{id}` - 任务详情（含干系人、状态历史）
- `POST /` - 创建任务
- `PUT /{id}` - 更新任务
- `DELETE /{id}` - 删除任务
- `POST /{id}/status` - 变更任务状态
- `GET /{id}/stakeholders` - 任务干系人列表
- `POST /{id}/stakeholders` - 添加干系人
- `DELETE /{id}/stakeholders/{stakeholder_id}` - 移除干系人

### 日报工时 `/api/v1/daily`
- `GET /work-logs` - 工时记录列表
- `POST /work-logs` - 创建工时记录
- `PUT /work-logs/{id}` - 更新工时记录
- `DELETE /work-logs/{id}` - 删除工时记录
- `GET /summaries` - 每日总结列表
- `POST /summaries` - 创建/更新每日总结
- `GET /reports` - 日报列表（聚合视图）
- `GET /reports/{member_id}/{date}` - 日报详情
- `POST /reports/quick` - 快速提交日报
- `GET /stats/hours` - 工时统计

### 周报管理 `/api/v1/weekly-reports`
- `GET /` - 周报列表
- `GET /{id}` - 周报详情（含原始数据）
- `POST /personal/generate` - 生成个人周报（AI）
- `POST /project/generate` - 生成项目周报（AI）
- `PUT /{id}` - 编辑周报
- `DELETE /{id}` - 删除周报

### 通知管理 `/api/v1/notifications`
- `GET /` - 通知列表
- `GET /unread-count` - 未读数量（右上角红点）
- `GET /{id}` - 通知详情
- `PUT /{id}/read` - 标记已读
- `PUT /read-batch` - 批量标记已读
- `PUT /read-all` - 全部已读
- `DELETE /{id}` - 删除通知
- `DELETE /clear-all` - 清除通知

## 开发说明

### 响应格式

所有API返回统一格式：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

分页响应：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```

### 认证方式

使用 Bearer Token 认证：

```
Authorization: Bearer <access_token>
```

### 权限级别

系统只有两种角色：

- **`admin` (管理员)**:
  - 创建、删除成员
  - 更改成员状态
  - 修改/删除任何人创建的内容

- **`member` (普通成员)**:
  - 查看所有信息
  - 创建项目、任务、会议纪要等
  - 只能修改/删除自己创建的内容
