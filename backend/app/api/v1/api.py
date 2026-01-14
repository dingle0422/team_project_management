"""
API V1 路由聚合
"""
from fastapi import APIRouter

from app.api.v1.endpoints import auth, members, projects, meetings, tasks, daily_logs, weekly_reports, notifications

api_router = APIRouter()

# 认证相关
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["认证"]
)

# 成员管理
api_router.include_router(
    members.router,
    prefix="/members",
    tags=["成员管理"]
)

# 项目管理
api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["项目管理"]
)

# 会议纪要
api_router.include_router(
    meetings.router,
    prefix="/meetings",
    tags=["会议纪要"]
)

# 任务管理
api_router.include_router(
    tasks.router,
    prefix="/tasks",
    tags=["任务管理"]
)

# 日报/工时
api_router.include_router(
    daily_logs.router,
    prefix="/daily-logs",
    tags=["日报工时"]
)

# 周报
api_router.include_router(
    weekly_reports.router,
    prefix="/weekly-reports",
    tags=["周报管理"]
)

# 通知
api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["通知管理"]
)
