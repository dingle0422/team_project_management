# 算法团队项目管理系统

一个专为算法团队设计的项目管理系统，支持项目进度跟踪、工时管理、日报填写和AI自动生成周报。

## ✨ 功能特性

- 🔐 **用户认证** - JWT token认证，角色权限管理
- 📁 **项目管理** - 项目CRUD、成员管理、进度跟踪
- 📝 **会议纪要** - 会议记录、任务关联
- ✅ **任务管理** - 五状态流转、干系人管理、子任务
- ⏱️ **工时管理** - 日报填写、工时统计、快速提交
- 🤖 **AI周报** - 基于OpenAI自动生成个人/项目周报

## 🏗️ 技术栈

- **后端**: Python 3.11 + FastAPI
- **数据库**: PostgreSQL 15
- **ORM**: SQLAlchemy 2.0
- **认证**: JWT (python-jose)
- **AI**: OpenAI API
- **部署**: Docker + Docker Compose

## 🚀 快速开始

### 方式一：Docker部署（推荐）

```bash
# 1. 克隆项目
git clone <repository-url>
cd project_management

# 2. 配置环境变量
cp backend/env.template backend/.env
# 编辑 .env 文件配置数据库和OpenAI密钥

# 3. 启动服务
docker-compose up -d

# 4. 初始化测试数据（可选）
docker-compose exec backend python scripts/seed_data.py

# 5. 访问API文档
# http://localhost:8000/api/v1/docs
```

### 方式二：本地开发

```bash
# 1. 进入后端目录
cd backend

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置环境变量
cp env.template .env
# 编辑 .env 文件

# 5. 启动PostgreSQL数据库
# 确保本地PostgreSQL已运行

# 6. 初始化数据库并启动
python scripts/start.py --init-db --reload

# 7. 创建测试数据（可选）
python scripts/seed_data.py
```

## 📖 API文档

启动服务后访问：
- Swagger UI: http://localhost:8000/api/v1/docs
- ReDoc: http://localhost:8000/api/v1/redoc

### 主要API模块

| 模块 | 路径 | 说明 |
|-----|-----|------|
| 认证 | `/api/v1/auth` | 登录、注册、修改密码 |
| 成员 | `/api/v1/members` | 成员CRUD |
| 项目 | `/api/v1/projects` | 项目和成员管理 |
| 会议 | `/api/v1/meetings` | 会议纪要CRUD |
| 任务 | `/api/v1/tasks` | 任务和干系人管理 |
| 日报 | `/api/v1/daily` | 工时记录和日报 |
| 周报 | `/api/v1/weekly-reports` | AI周报生成 |

## 📋 任务状态流转

```
待办(todo) → 任务评审(task_review) → 进行中(in_progress) → 成果评审(result_review) → 完成(done)
```

## 🔐 权限说明

| 角色 | 权限 |
|-----|------|
| **admin** | 管理成员、修改所有内容 |
| **member** | 查看所有、只能修改自己创建的内容 |

## 🗂️ 项目结构

```
project_management/
├── backend/                 # 后端代码
│   ├── app/
│   │   ├── api/            # API路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据模型
│   │   ├── schemas/        # Pydantic模型
│   │   ├── services/       # 业务服务
│   │   └── main.py         # 入口
│   ├── alembic/            # 数据库迁移
│   ├── scripts/            # 脚本
│   ├── Dockerfile
│   └── requirements.txt
├── prototype/              # 前端原型
├── docs/                   # 文档
├── docker-compose.yml
└── README.md
```

## ⚙️ 环境变量

| 变量 | 说明 | 默认值 |
|-----|------|-------|
| `DATABASE_URL` | PostgreSQL连接字符串 | - |
| `SECRET_KEY` | JWT密钥 | - |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token过期时间 | 1440 |
| `OPENAI_API_KEY` | OpenAI API密钥 | - |
| `OPENAI_MODEL` | AI模型 | gpt-4 |
| `OPENAI_BASE_URL` | API代理地址 | - |

## 📊 测试账号

初始化测试数据后可用：

| 账号 | 密码 | 角色 |
|-----|------|------|
| admin@example.com | admin123 | 管理员 |
| zhangsan@example.com | 123456 | 普通成员 |

## 🛠️ 开发命令

```bash
# 数据库迁移
alembic revision --autogenerate -m "描述"
alembic upgrade head

# 创建测试数据
python scripts/seed_data.py

# 开发模式启动
python scripts/start.py --reload

# Docker开发模式
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## 📄 许可证

MIT License
