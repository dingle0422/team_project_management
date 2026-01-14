# API 规范文档

> **版本**: v1.0  
> **基础路径**: `/api/v1`  
> **认证方式**: JWT Bearer Token

---

## 目录

1. [通用规范](#1-通用规范)
2. [认证接口](#2-认证接口)
3. [成员管理](#3-成员管理)
4. [项目管理](#4-项目管理)
5. [会议纪要](#5-会议纪要)
6. [任务管理](#6-任务管理)
7. [日报管理](#7-日报管理)
8. [周报管理](#8-周报管理)
9. [数据统计](#9-数据统计)

---

## 1. 通用规范

### 1.1 请求头

```http
Authorization: Bearer <token>
Content-Type: application/json
```

### 1.2 响应格式

**成功响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

**列表响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "page_size": 20,
    "total_pages": 5
  }
}
```

**错误响应**:
```json
{
  "code": 400,
  "message": "参数错误",
  "errors": [
    { "field": "email", "message": "邮箱格式不正确" }
  ]
}
```

### 1.3 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器错误 |

### 1.4 分页参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 |
| page_size | int | 20 | 每页数量（最大100） |

---

## 2. 认证接口

### 2.1 用户登录

```
POST /api/v1/auth/login
```

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应**:
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "access_token": "eyJ...",
    "token_type": "bearer",
    "expires_in": 86400,
    "user": {
      "id": 1,
      "name": "张三",
      "email": "user@example.com",
      "role": "member",
      "avatar_url": "https://..."
    }
  }
}
```

### 2.2 获取当前用户信息

```
GET /api/v1/auth/me
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "name": "张三",
    "email": "user@example.com",
    "role": "member",
    "job_title": "算法工程师",
    "avatar_url": "https://...",
    "status": "active"
  }
}
```

### 2.3 修改密码

```
PUT /api/v1/auth/password
```

**请求体**:
```json
{
  "old_password": "oldpass123",
  "new_password": "newpass123"
}
```

---

## 3. 成员管理

### 3.1 获取成员列表

```
GET /api/v1/members
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态筛选: active, inactive |
| role | string | 角色筛选: admin, manager, member |
| keyword | string | 关键词搜索（姓名/邮箱） |

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "张三",
        "email": "zhangsan@example.com",
        "role": "member",
        "job_title": "算法工程师",
        "status": "active",
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "page_size": 20
  }
}
```

### 3.2 获取成员详情

```
GET /api/v1/members/{id}
```

### 3.3 创建成员

```
POST /api/v1/members
```

**请求体**:
```json
{
  "name": "张三",
  "email": "zhangsan@example.com",
  "password": "initial_password",
  "role": "member",
  "job_title": "算法工程师",
  "phone": "13800138000"
}
```

### 3.4 更新成员

```
PUT /api/v1/members/{id}
```

**请求体**:
```json
{
  "name": "张三",
  "job_title": "高级算法工程师",
  "phone": "13800138001"
}
```

### 3.5 禁用/启用成员

```
PATCH /api/v1/members/{id}/status
```

**请求体**:
```json
{
  "status": "inactive"
}
```

---

## 4. 项目管理

### 4.1 获取项目列表

```
GET /api/v1/projects
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 状态: active, completed, suspended, archived |
| owner_id | int | 负责人ID |
| keyword | string | 关键词搜索 |
| my_projects | bool | 只显示我参与的项目 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "智能推荐系统",
        "code": "AI-2026-001",
        "description": "基于深度学习的推荐系统",
        "status": "active",
        "priority": "high",
        "start_date": "2026-01-01",
        "end_date": "2026-06-30",
        "owner": {
          "id": 1,
          "name": "张三"
        },
        "member_count": 5,
        "task_stats": {
          "total": 20,
          "completed": 8,
          "in_progress": 5
        },
        "created_at": "2026-01-01T00:00:00Z"
      }
    ],
    "total": 5
  }
}
```

### 4.2 获取项目详情

```
GET /api/v1/projects/{id}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "name": "智能推荐系统",
    "code": "AI-2026-001",
    "description": "基于深度学习的推荐系统",
    "status": "active",
    "priority": "high",
    "start_date": "2026-01-01",
    "end_date": "2026-06-30",
    "owner": {
      "id": 1,
      "name": "张三"
    },
    "members": [
      { "id": 1, "name": "张三", "role": "owner" },
      { "id": 2, "name": "李四", "role": "developer" }
    ],
    "progress": {
      "total_tasks": 20,
      "completed_tasks": 8,
      "completion_rate": 40.00,
      "estimated_hours": 200,
      "actual_hours": 85.5
    }
  }
}
```

### 4.3 创建项目

```
POST /api/v1/projects
```

**请求体**:
```json
{
  "name": "智能推荐系统",
  "code": "AI-2026-001",
  "description": "基于深度学习的推荐系统",
  "priority": "high",
  "start_date": "2026-01-01",
  "end_date": "2026-06-30",
  "owner_id": 1,
  "member_ids": [1, 2, 3]
}
```

### 4.4 更新项目

```
PUT /api/v1/projects/{id}
```

### 4.5 管理项目成员

```
POST /api/v1/projects/{id}/members
```

**请求体**:
```json
{
  "member_id": 4,
  "role": "developer"
}
```

```
DELETE /api/v1/projects/{id}/members/{member_id}
```

### 4.6 获取项目成员列表

```
GET /api/v1/projects/{id}/members
```

---

## 5. 会议纪要

### 5.1 获取会议纪要列表

```
GET /api/v1/projects/{project_id}/meetings
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "项目启动会议",
        "meeting_date": "2026-01-05T10:00:00Z",
        "location": "会议室A",
        "summary": "确定项目目标和分工",
        "attendee_count": 5,
        "task_count": 8,
        "created_by": {
          "id": 1,
          "name": "张三"
        }
      }
    ]
  }
}
```

### 5.2 获取会议纪要详情

```
GET /api/v1/meetings/{id}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "project_id": 1,
    "title": "项目启动会议",
    "meeting_date": "2026-01-05T10:00:00Z",
    "location": "会议室A",
    "summary": "确定项目目标和分工",
    "content": "## 会议内容\n\n1. 项目背景介绍...",
    "attendees": [
      { "id": 1, "name": "张三" },
      { "id": 2, "name": "李四" }
    ],
    "tasks": [
      { "id": 1, "title": "需求分析", "status": "done" },
      { "id": 2, "title": "系统设计", "status": "in_progress" }
    ],
    "created_by": {
      "id": 1,
      "name": "张三"
    }
  }
}
```

### 5.3 创建会议纪要

```
POST /api/v1/projects/{project_id}/meetings
```

**请求体**:
```json
{
  "title": "项目启动会议",
  "meeting_date": "2026-01-05T10:00:00Z",
  "location": "会议室A",
  "summary": "确定项目目标和分工",
  "content": "## 会议内容\n\n1. 项目背景介绍...",
  "attendee_ids": [1, 2, 3, 4, 5]
}
```

### 5.4 更新会议纪要

```
PUT /api/v1/meetings/{id}
```

### 5.5 删除会议纪要

```
DELETE /api/v1/meetings/{id}
```

---

## 6. 任务管理

### 6.1 获取任务列表

```
GET /api/v1/tasks
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| project_id | int | 项目ID |
| assignee_id | int | 负责人ID |
| status | string | 状态: todo, in_progress, review, done |
| priority | string | 优先级: low, medium, high, urgent |
| meeting_id | int | 关联会议ID |
| my_tasks | bool | 只显示我的任务 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "title": "推荐算法核心开发",
        "description": "实现基于协同过滤的推荐算法",
        "project": {
          "id": 1,
          "name": "智能推荐系统"
        },
        "meeting": {
          "id": 1,
          "title": "项目启动会议"
        },
        "assignee": {
          "id": 2,
          "name": "李四"
        },
        "status": "in_progress",
        "priority": "high",
        "estimated_hours": 40,
        "actual_hours": 25.5,
        "start_date": "2026-01-10",
        "due_date": "2026-01-20",
        "created_at": "2026-01-05T10:00:00Z"
      }
    ]
  }
}
```

### 6.2 获取项目任务列表

```
GET /api/v1/projects/{project_id}/tasks
```

### 6.3 获取任务详情

```
GET /api/v1/tasks/{id}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "title": "推荐算法核心开发",
    "description": "实现基于协同过滤的推荐算法",
    "project": { "id": 1, "name": "智能推荐系统" },
    "meeting": { "id": 1, "title": "项目启动会议" },
    "assignee": { "id": 2, "name": "李四" },
    "status": "in_progress",
    "priority": "high",
    "task_type": "feature",
    "estimated_hours": 40,
    "actual_hours": 25.5,
    "start_date": "2026-01-10",
    "due_date": "2026-01-20",
    "completed_at": null,
    "parent_task": null,
    "sub_tasks": [],
    "work_logs": [
      {
        "id": 1,
        "work_date": "2026-01-10",
        "hours": 6,
        "description": "完成算法框架搭建",
        "member": { "id": 2, "name": "李四" }
      }
    ],
    "status_history": [
      {
        "from_status": "todo",
        "to_status": "in_progress",
        "changed_by": { "id": 2, "name": "李四" },
        "changed_at": "2026-01-10T09:00:00Z"
      }
    ]
  }
}
```

### 6.4 创建任务

```
POST /api/v1/projects/{project_id}/tasks
```

**请求体**:
```json
{
  "title": "推荐算法核心开发",
  "description": "实现基于协同过滤的推荐算法",
  "meeting_id": 1,
  "assignee_id": 2,
  "estimated_hours": 40,
  "priority": "high",
  "task_type": "feature",
  "start_date": "2026-01-10",
  "due_date": "2026-01-20",
  "parent_task_id": null
}
```

> **注意**: `meeting_id` 为必填字段，可以传 `null` 表示"无关联会议"

### 6.5 更新任务

```
PUT /api/v1/tasks/{id}
```

### 6.6 更新任务状态

```
PATCH /api/v1/tasks/{id}/status
```

**请求体**:
```json
{
  "status": "done",
  "comment": "功能开发完成，已提交代码"
}
```

### 6.7 删除任务

```
DELETE /api/v1/tasks/{id}
```

---

## 7. 日报管理

### 7.1 获取日报工作记录

```
GET /api/v1/daily-logs
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| member_id | int | 成员ID |
| project_id | int | 项目ID |
| task_id | int | 任务ID |
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "items": [
      {
        "id": 1,
        "work_date": "2026-01-14",
        "member": { "id": 1, "name": "张三" },
        "project": { "id": 1, "name": "智能推荐系统" },
        "task": { "id": 1, "title": "推荐算法核心开发" },
        "hours": 4.5,
        "description": "完成协同过滤算法的核心代码编写",
        "work_type": "development"
      }
    ]
  }
}
```

### 7.2 获取某天的日报

```
GET /api/v1/daily-logs/date/{date}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| member_id | int | 成员ID（管理员查看他人日报时使用） |

**响应**:
```json
{
  "code": 200,
  "data": {
    "date": "2026-01-14",
    "member": { "id": 1, "name": "张三" },
    "logs": [
      {
        "id": 1,
        "project": { "id": 1, "name": "智能推荐系统" },
        "task": { "id": 1, "title": "推荐算法核心开发" },
        "hours": 4.5,
        "description": "完成协同过滤算法的核心代码编写",
        "work_type": "development"
      },
      {
        "id": 2,
        "project": { "id": 1, "name": "智能推荐系统" },
        "task": { "id": 2, "title": "API接口开发" },
        "hours": 2,
        "description": "完成推荐接口的开发和测试",
        "work_type": "development"
      }
    ],
    "summary": {
      "problems": "模型训练速度较慢，需要优化",
      "tomorrow_plan": "1. 优化模型训练\n2. 编写单元测试"
    },
    "total_hours": 6.5
  }
}
```

### 7.3 提交日报

```
POST /api/v1/daily-logs
```

**请求体**:
```json
{
  "work_date": "2026-01-14",
  "logs": [
    {
      "project_id": 1,
      "task_id": 1,
      "hours": 4.5,
      "description": "完成协同过滤算法的核心代码编写",
      "work_type": "development"
    },
    {
      "project_id": 1,
      "task_id": 2,
      "hours": 2,
      "description": "完成推荐接口的开发和测试",
      "work_type": "development"
    }
  ],
  "problems": "模型训练速度较慢，需要优化",
  "tomorrow_plan": "1. 优化模型训练\n2. 编写单元测试"
}
```

### 7.4 更新日报条目

```
PUT /api/v1/daily-logs/{id}
```

**请求体**:
```json
{
  "hours": 5,
  "description": "完成协同过滤算法的核心代码编写和优化",
  "work_type": "development"
}
```

### 7.5 删除日报条目

```
DELETE /api/v1/daily-logs/{id}
```

### 7.6 获取团队日报

```
GET /api/v1/daily-logs/team
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| date | date | 日期 |
| project_id | int | 项目ID |

---

## 8. 周报管理

### 8.1 获取周报列表

```
GET /api/v1/weekly-reports
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| report_type | string | 类型: personal, project |
| member_id | int | 成员ID（个人周报） |
| project_id | int | 项目ID（项目周报） |
| week_start | date | 周开始日期 |

### 8.2 生成个人周报

```
POST /api/v1/weekly-reports/generate/personal
```

**请求体**:
```json
{
  "member_id": 1,
  "week_start": "2026-01-06",
  "week_end": "2026-01-12"
}
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "id": 1,
    "report_type": "personal",
    "member": { "id": 1, "name": "张三" },
    "week_start": "2026-01-06",
    "week_end": "2026-01-12",
    "summary": "本周主要参与智能推荐系统项目的核心算法开发...",
    "achievements": "1. 完成协同过滤算法核心模块开发\n2. 完成推荐API接口开发\n3. 解决了模型训练速度问题",
    "issues": "1. 数据预处理流程较复杂，已与数据团队协调优化方案",
    "next_week_plan": "1. 完成算法性能优化\n2. 编写技术文档\n3. 进行代码Review",
    "ai_model": "gpt-4",
    "generated_at": "2026-01-13T10:00:00Z",
    "is_reviewed": false
  }
}
```

### 8.3 生成项目周报

```
POST /api/v1/weekly-reports/generate/project
```

**请求体**:
```json
{
  "project_id": 1,
  "week_start": "2026-01-06",
  "week_end": "2026-01-12"
}
```

### 8.4 获取周报详情

```
GET /api/v1/weekly-reports/{id}
```

### 8.5 更新周报（人工编辑）

```
PUT /api/v1/weekly-reports/{id}
```

**请求体**:
```json
{
  "edited_summary": "修改后的总结内容...",
  "edited_achievements": "修改后的成果内容...",
  "edited_issues": "修改后的问题内容...",
  "edited_next_week_plan": "修改后的下周计划..."
}
```

### 8.6 审核周报

```
PATCH /api/v1/weekly-reports/{id}/review
```

**请求体**:
```json
{
  "is_reviewed": true
}
```

### 8.7 导出周报

```
GET /api/v1/weekly-reports/{id}/export
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| format | string | 导出格式: pdf, docx, md |

---

## 9. 数据统计

### 9.1 个人工时统计

```
GET /api/v1/stats/member/{member_id}/hours
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |
| group_by | string | 分组: day, week, month, project |

**响应**:
```json
{
  "code": 200,
  "data": {
    "member": { "id": 1, "name": "张三" },
    "period": {
      "start": "2026-01-01",
      "end": "2026-01-14"
    },
    "total_hours": 85.5,
    "by_project": [
      { "project_id": 1, "project_name": "智能推荐系统", "hours": 60.5 },
      { "project_id": 2, "project_name": "数据平台", "hours": 25 }
    ],
    "by_date": [
      { "date": "2026-01-13", "hours": 7.5 },
      { "date": "2026-01-14", "hours": 6.5 }
    ],
    "task_count": 8,
    "completed_task_count": 5
  }
}
```

### 9.2 项目进度统计

```
GET /api/v1/stats/project/{project_id}/progress
```

**响应**:
```json
{
  "code": 200,
  "data": {
    "project": { "id": 1, "name": "智能推荐系统" },
    "task_stats": {
      "total": 20,
      "todo": 5,
      "in_progress": 7,
      "review": 2,
      "done": 6,
      "completion_rate": 30.00
    },
    "hours_stats": {
      "estimated_total": 400,
      "actual_total": 180.5,
      "variance": -219.5,
      "variance_rate": -54.88
    },
    "member_contribution": [
      { "member_id": 1, "name": "张三", "hours": 60.5, "percentage": 33.52 },
      { "member_id": 2, "name": "李四", "hours": 80, "percentage": 44.32 },
      { "member_id": 3, "name": "王五", "hours": 40, "percentage": 22.16 }
    ],
    "burndown": [
      { "date": "2026-01-06", "remaining_hours": 400 },
      { "date": "2026-01-07", "remaining_hours": 380 },
      { "date": "2026-01-08", "remaining_hours": 350 }
    ]
  }
}
```

### 9.3 团队工时概览

```
GET /api/v1/stats/team/overview
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| start_date | date | 开始日期 |
| end_date | date | 结束日期 |

**响应**:
```json
{
  "code": 200,
  "data": {
    "period": {
      "start": "2026-01-06",
      "end": "2026-01-12"
    },
    "total_hours": 320.5,
    "member_count": 10,
    "avg_hours_per_member": 32.05,
    "by_member": [
      { "member_id": 1, "name": "张三", "hours": 40, "log_days": 5 },
      { "member_id": 2, "name": "李四", "hours": 38.5, "log_days": 5 }
    ],
    "by_project": [
      { "project_id": 1, "name": "智能推荐系统", "hours": 180.5 },
      { "project_id": 2, "name": "数据平台", "hours": 140 }
    ]
  }
}
```

### 9.4 工时趋势

```
GET /api/v1/stats/trends/hours
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| member_id | int | 成员ID（可选） |
| project_id | int | 项目ID（可选） |
| period | string | 周期: week, month |
| count | int | 周期数量（默认12） |

**响应**:
```json
{
  "code": 200,
  "data": {
    "period_type": "week",
    "trends": [
      { "period_start": "2025-10-28", "hours": 38.5 },
      { "period_start": "2025-11-04", "hours": 42 },
      { "period_start": "2025-11-11", "hours": 40.5 }
    ]
  }
}
```

---

## 附录：工作类型枚举

| 值 | 说明 |
|------|------|
| development | 开发 |
| debugging | 调试 |
| testing | 测试 |
| documentation | 文档 |
| meeting | 会议 |
| research | 调研 |
| review | 代码评审 |
| deployment | 部署 |
| other | 其他 |

---

**文档结束**
