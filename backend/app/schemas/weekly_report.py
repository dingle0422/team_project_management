"""
周报相关Schema
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief


# ==================== 周报生成请求 ====================

class PersonalWeeklyReportRequest(BaseModel):
    """生成个人周报请求"""
    member_id: Optional[int] = Field(None, description="成员ID，默认为当前用户")
    week_start: date = Field(..., description="周开始日期")
    week_end: date = Field(..., description="周结束日期")


class ProjectWeeklyReportRequest(BaseModel):
    """生成项目周报请求"""
    project_id: int = Field(..., description="项目ID")
    week_start: date = Field(..., description="周开始日期")
    week_end: date = Field(..., description="周结束日期")


# ==================== 周报编辑 ====================

class WeeklyReportUpdate(BaseModel):
    """编辑周报"""
    edited_summary: Optional[str] = Field(None, description="编辑后的总结")
    edited_achievements: Optional[str] = Field(None, description="编辑后的成果")
    edited_issues: Optional[str] = Field(None, description="编辑后的问题")
    edited_next_week_plan: Optional[str] = Field(None, description="编辑后的计划")


# ==================== 周报响应 ====================

class WeeklyReportInfo(BaseModel):
    """周报信息"""
    id: int
    report_type: str
    member: Optional[MemberBrief] = None
    project: Optional[ProjectBrief] = None
    week_start: date
    week_end: date
    
    # AI生成内容
    summary: Optional[str] = None
    achievements: Optional[str] = None
    issues: Optional[str] = None
    next_week_plan: Optional[str] = None
    
    # 编辑后内容
    edited_summary: Optional[str] = None
    edited_achievements: Optional[str] = None
    edited_issues: Optional[str] = None
    edited_next_week_plan: Optional[str] = None
    
    # 元信息
    ai_model: Optional[str] = None
    is_reviewed: bool = False
    reviewer: Optional[MemberBrief] = None
    reviewed_at: Optional[datetime] = None
    generated_at: datetime
    
    class Config:
        from_attributes = True


class WeeklyReportDetail(WeeklyReportInfo):
    """周报详情（含原始数据）"""
    raw_data: Optional[dict] = None


class WeeklyReportListItem(BaseModel):
    """周报列表项"""
    id: int
    report_type: str
    member: Optional[MemberBrief] = None
    project: Optional[ProjectBrief] = None
    week_start: date
    week_end: date
    # 添加内容字段用于预览
    summary: Optional[str] = None
    achievements: Optional[str] = None
    issues: Optional[str] = None
    next_week_plan: Optional[str] = None
    ai_model: Optional[str] = None
    is_reviewed: bool
    generated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 数据统计（用于AI生成） ====================

class TaskSummaryForReport(BaseModel):
    """任务摘要（用于周报生成）"""
    task_id: int
    title: str
    status: str
    priority: str
    estimated_hours: Optional[float] = None
    actual_hours: float = 0
    status_changes: List[dict] = []  # 状态变更历史


class WorkLogSummaryForReport(BaseModel):
    """工时摘要（用于周报生成）"""
    project_name: str
    task_title: str
    hours: float
    description: str
    work_date: date


class DailySummaryForReport(BaseModel):
    """每日总结（用于周报生成）"""
    summary_date: date
    problems: Optional[str] = None
    tomorrow_plan: Optional[str] = None


class PersonalWeeklyData(BaseModel):
    """个人周报原始数据"""
    member_name: str
    week_start: date
    week_end: date
    total_hours: float
    work_logs: List[WorkLogSummaryForReport]
    tasks_worked: List[TaskSummaryForReport]
    daily_summaries: List[DailySummaryForReport]
    completed_tasks_count: int
    in_progress_tasks_count: int


class ProjectWeeklyData(BaseModel):
    """项目周报原始数据"""
    project_name: str
    week_start: date
    week_end: date
    total_hours: float
    member_contributions: List[dict]  # [{member_name, hours, tasks_count}]
    tasks_completed: List[TaskSummaryForReport]
    tasks_in_progress: List[TaskSummaryForReport]
    new_tasks: List[TaskSummaryForReport]
    meetings_held: List[dict]  # [{title, date, summary}]
