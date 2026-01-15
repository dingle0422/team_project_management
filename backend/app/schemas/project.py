"""
项目相关Schema
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief


# ==================== 基础模型 ====================

class ProjectBase(BaseModel):
    """项目基础信息"""
    name: str = Field(..., min_length=1, max_length=100, description="项目名称")
    code: Optional[str] = Field(None, max_length=30, description="项目编号")
    description: Optional[str] = Field(None, description="项目描述")
    priority: str = Field("medium", description="优先级: low, medium, high")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="截止日期")


class ProjectCreate(ProjectBase):
    """创建项目"""
    description: str = Field(..., min_length=1, description="项目描述")  # 创建时必填
    business_party: str = Field(..., min_length=1, max_length=200, description="业务方")
    owner_id: Optional[int] = Field(None, description="负责人ID")
    member_ids: Optional[List[int]] = Field(None, description="成员ID列表")


class ProjectUpdate(BaseModel):
    """更新项目"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    code: Optional[str] = Field(None, max_length=30)
    description: Optional[str] = None
    business_party: Optional[str] = Field(None, max_length=200, description="业务方")
    status: Optional[str] = None
    priority: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner_id: Optional[int] = None


# ==================== 项目成员 ====================

class ProjectMemberAdd(BaseModel):
    """添加项目成员"""
    member_id: int
    role: str = Field("developer", description="角色")


class ProjectMemberInfo(BaseModel):
    """项目成员信息"""
    id: int
    name: str
    role: str
    avatar_url: Optional[str] = None
    joined_at: datetime
    
    class Config:
        from_attributes = True


# ==================== 响应模型 ====================

class TaskStats(BaseModel):
    """任务统计"""
    total: int = 0
    completed: int = 0
    in_progress: int = 0


class ProjectInfo(ProjectBase):
    """项目信息响应"""
    id: int
    status: str
    business_party: Optional[str] = None
    owner: Optional[MemberBrief] = None
    creator: Optional[MemberBrief] = None
    created_by: Optional[int] = None
    member_count: int = 0
    task_stats: Optional[TaskStats] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ProjectDetail(ProjectInfo):
    """项目详情"""
    members: List[ProjectMemberInfo] = []
    progress: Optional[dict] = None


class ProjectBrief(BaseModel):
    """项目简要信息"""
    id: int
    name: str
    code: Optional[str] = None
    
    class Config:
        from_attributes = True
