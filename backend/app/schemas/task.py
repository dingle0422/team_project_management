"""
任务相关Schema
"""
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief
from app.schemas.meeting import MeetingBrief


# ==================== 任务状态常量 ====================

# 状态流转: todo → task_review → in_progress → result_review → done
TASK_STATUS_TODO = "todo"
TASK_STATUS_TASK_REVIEW = "task_review"
TASK_STATUS_IN_PROGRESS = "in_progress"
TASK_STATUS_RESULT_REVIEW = "result_review"
TASK_STATUS_DONE = "done"
TASK_STATUS_CANCELLED = "cancelled"

VALID_TASK_STATUSES = [
    TASK_STATUS_TODO,
    TASK_STATUS_TASK_REVIEW,
    TASK_STATUS_IN_PROGRESS,
    TASK_STATUS_RESULT_REVIEW,
    TASK_STATUS_DONE,
    TASK_STATUS_CANCELLED,
]

# 状态流转规则
STATUS_TRANSITIONS = {
    TASK_STATUS_TODO: [TASK_STATUS_TASK_REVIEW, TASK_STATUS_CANCELLED],
    TASK_STATUS_TASK_REVIEW: [TASK_STATUS_TODO, TASK_STATUS_IN_PROGRESS, TASK_STATUS_CANCELLED],
    TASK_STATUS_IN_PROGRESS: [TASK_STATUS_RESULT_REVIEW, TASK_STATUS_CANCELLED],
    TASK_STATUS_RESULT_REVIEW: [TASK_STATUS_IN_PROGRESS, TASK_STATUS_DONE, TASK_STATUS_CANCELLED],
    TASK_STATUS_DONE: [],  # 已完成不能再转换
    TASK_STATUS_CANCELLED: [TASK_STATUS_TODO],  # 可以重新激活
}


# ==================== 干系人 ====================

class TaskStakeholderAdd(BaseModel):
    """添加任务干系人"""
    member_id: int
    role: str = Field("stakeholder", description="角色: stakeholder, reviewer, collaborator")


class TaskStakeholderInfo(BaseModel):
    """任务干系人信息"""
    id: int
    member_id: int
    name: str
    role: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== 状态变更 ====================

class TaskStatusChange(BaseModel):
    """任务状态变更"""
    new_status: str = Field(..., description="新状态")
    comment: Optional[str] = Field(None, description="变更说明")
    # 评审相关
    review_result: Optional[str] = Field(None, description="评审结果: passed, rejected")
    review_feedback: Optional[str] = Field(None, description="评审意见")


class TaskStatusApprovalInfo(BaseModel):
    """状态变更审批信息"""
    id: int
    stakeholder_id: int
    stakeholder_name: str
    stakeholder_avatar: Optional[str] = None
    approval_status: str  # pending, approved, rejected
    comment: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class TaskStatusHistoryInfo(BaseModel):
    """状态变更历史"""
    id: int
    from_status: Optional[str]
    to_status: str
    changed_by: Optional[MemberBrief] = None
    comment: Optional[str] = None
    review_type: Optional[str] = None
    review_result: Optional[str] = None
    review_feedback: Optional[str] = None
    changed_at: datetime
    # 审批信息
    is_pending_approval: bool = False  # 是否等待审批
    approvals: List["TaskStatusApprovalInfo"] = []
    
    class Config:
        from_attributes = True


class TaskApprovalAction(BaseModel):
    """干系人审批操作"""
    action: str = Field(..., description="审批操作: approve, reject")
    comment: Optional[str] = Field(None, description="审批意见")


# ==================== 任务基础模型 ====================

class TaskBase(BaseModel):
    """任务基础信息"""
    title: str = Field(..., min_length=1, max_length=200, description="任务标题")
    description: Optional[str] = Field(None, description="任务描述")
    requester_name: Optional[str] = Field(None, max_length=100, description="需求方名称")
    estimated_hours: Optional[Decimal] = Field(None, ge=0, description="预估工时")
    priority: str = Field("medium", description="优先级: low, medium, high, urgent")
    task_type: Optional[str] = Field(None, description="任务类型: feature, bugfix, research, documentation")
    start_date: Optional[date] = Field(None, description="开始日期")
    due_date: Optional[date] = Field(None, description="截止日期")


class TaskCreate(TaskBase):
    """创建任务"""
    project_id: int = Field(..., description="项目ID")
    meeting_id: Optional[int] = Field(None, description="关联会议纪要ID")
    assignee_id: Optional[int] = Field(None, description="负责人ID")
    parent_task_id: Optional[int] = Field(None, description="父任务ID")
    stakeholder_ids: Optional[List[int]] = Field(None, description="干系人ID列表")


class TaskUpdate(BaseModel):
    """更新任务"""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    requester_name: Optional[str] = Field(None, max_length=100)
    meeting_id: Optional[int] = None
    assignee_id: Optional[int] = None
    estimated_hours: Optional[Decimal] = Field(None, ge=0)
    priority: Optional[str] = None
    task_type: Optional[str] = None
    start_date: Optional[date] = None
    due_date: Optional[date] = None
    sort_order: Optional[int] = None
    stakeholder_ids: Optional[List[int]] = Field(None, description="审核人ID列表")


# ==================== 响应模型 ====================

class TaskInfo(TaskBase):
    """任务信息响应"""
    id: int
    project_id: int
    project: Optional[ProjectBrief] = None
    meeting_id: Optional[int] = None
    meeting: Optional[MeetingBrief] = None
    assignee: Optional[MemberBrief] = None
    status: str
    actual_hours: Decimal = Decimal("0")
    parent_task_id: Optional[int] = None
    sort_order: int = 0
    stakeholder_count: int = 0
    stakeholders: List[TaskStakeholderInfo] = []  # 审核人列表
    sub_task_count: int = 0
    created_by: Optional[MemberBrief] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class PendingApprovalInfo(BaseModel):
    """待审批信息"""
    status_change_id: int
    from_status: str
    to_status: str
    requester: Optional[MemberBrief] = None
    requested_at: datetime
    approvals: List[TaskStatusApprovalInfo] = []
    
    class Config:
        from_attributes = True


class TaskDetail(TaskInfo):
    """任务详情"""
    stakeholders: List[TaskStakeholderInfo] = []
    status_history: List[TaskStatusHistoryInfo] = []
    sub_tasks: List["TaskInfo"] = []
    # 待审批信息（如果有）
    pending_approval: Optional[PendingApprovalInfo] = None


class TaskBrief(BaseModel):
    """任务简要信息"""
    id: int
    title: str
    status: str
    priority: str
    
    class Config:
        from_attributes = True
