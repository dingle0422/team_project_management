"""
会议纪要相关Schema
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief


# ==================== 基础模型 ====================

class MeetingBase(BaseModel):
    """会议纪要基础信息"""
    title: str = Field(..., min_length=1, max_length=200, description="会议标题")
    meeting_date: date = Field(..., description="会议日期")
    location: Optional[str] = Field(None, max_length=100, description="会议地点")
    summary: Optional[str] = Field(None, description="会议摘要")
    content: Optional[str] = Field(None, description="会议内容/纪要详情")


class MeetingCreate(MeetingBase):
    """创建会议纪要"""
    project_id: int = Field(..., description="项目ID")
    attendee_ids: Optional[List[int]] = Field(None, description="参会人ID列表")


class MeetingUpdate(BaseModel):
    """更新会议纪要"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    meeting_date: Optional[date] = None
    location: Optional[str] = Field(None, max_length=100)
    summary: Optional[str] = None
    content: Optional[str] = None
    attendee_ids: Optional[List[int]] = None


# ==================== 响应模型 ====================

class MeetingInfo(MeetingBase):
    """会议纪要信息响应"""
    id: int
    project_id: int
    project: Optional[ProjectBrief] = None
    attendee_count: int = 0
    task_count: int = 0
    created_by: Optional[MemberBrief] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class MeetingDetail(MeetingInfo):
    """会议纪要详情"""
    attendees: List[MemberBrief] = []
    # tasks 将在后续添加


class MeetingBrief(BaseModel):
    """会议纪要简要信息"""
    id: int
    title: str
    meeting_date: date
    
    class Config:
        from_attributes = True
