"""
日报/工时相关Schema
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief
from app.schemas.task import TaskBrief


# ==================== 工时记录 ====================

class WorkLogBase(BaseModel):
    """工时记录基础信息"""
    hours: Decimal = Field(..., gt=0, le=24, description="工时")
    description: str = Field(..., min_length=1, description="工作内容描述")
    work_type: Optional[str] = Field("development", description="工作类型")
    problems: Optional[str] = Field(None, description="遇到的问题")
    tomorrow_plan: Optional[str] = Field(None, description="明日计划")


class WorkLogCreate(WorkLogBase):
    """创建工时记录"""
    task_id: int = Field(..., description="任务ID")
    work_date: date = Field(..., description="工作日期")


class WorkLogUpdate(BaseModel):
    """更新工时记录"""
    hours: Optional[Decimal] = Field(None, gt=0, le=24)
    description: Optional[str] = Field(None, min_length=1)
    work_type: Optional[str] = None
    problems: Optional[str] = None
    tomorrow_plan: Optional[str] = None


class WorkLogInfo(WorkLogBase):
    """工时记录信息"""
    id: int
    member_id: int
    member: Optional[MemberBrief] = None
    task_id: int
    task: Optional[TaskBrief] = None
    project_id: int
    project: Optional[ProjectBrief] = None
    work_date: date
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 每日总结 ====================

class DailySummaryBase(BaseModel):
    """每日总结基础信息"""
    problems: Optional[str] = Field(None, description="今日遇到的问题")
    tomorrow_plan: Optional[str] = Field(None, description="明日计划")
    notes: Optional[str] = Field(None, description="其他备注")


class DailySummaryCreate(DailySummaryBase):
    """创建/更新每日总结"""
    summary_date: date = Field(..., description="总结日期")


class DailySummaryInfo(DailySummaryBase):
    """每日总结信息"""
    id: int
    member_id: int
    summary_date: date
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 日报（聚合视图） ====================

class DailyReportInfo(BaseModel):
    """日报信息（工时记录+总结的聚合视图）"""
    report_date: date
    member: MemberBrief
    total_hours: Decimal
    work_logs: List[WorkLogInfo]
    summary: Optional[DailySummaryInfo] = None


class DailyReportListItem(BaseModel):
    """日报列表项"""
    report_date: date
    member: MemberBrief
    total_hours: Decimal
    work_log_count: int
    has_summary: bool


# ==================== 快速日报提交 ====================

class QuickDailyReportCreate(BaseModel):
    """快速提交日报"""
    report_date: date = Field(..., description="日报日期")
    work_logs: List[WorkLogCreate] = Field(..., min_length=1, description="工时记录列表")
    problems: Optional[str] = Field(None, description="今日遇到的问题")
    tomorrow_plan: Optional[str] = Field(None, description="明日计划")
    notes: Optional[str] = Field(None, description="其他备注")


# ==================== 工时统计 ====================

class WorkHoursSummary(BaseModel):
    """工时统计"""
    total_hours: Decimal
    by_project: List[dict]  # [{project_id, project_name, hours}]
    by_task_type: List[dict]  # [{work_type, hours}]
    by_date: List[dict]  # [{date, hours}]
