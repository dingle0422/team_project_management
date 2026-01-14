"""
通知相关Schema
"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from app.schemas.member import MemberBrief


# ==================== 通知类型常量 ====================

NOTIFICATION_TYPE_MENTION = "mention"           # @提及
NOTIFICATION_TYPE_ASSIGNMENT = "assignment"     # 任务分配
NOTIFICATION_TYPE_STATUS_CHANGE = "status_change"  # 状态变更
NOTIFICATION_TYPE_REVIEW = "review"             # 评审请求

CONTENT_TYPE_TASK = "task"
CONTENT_TYPE_MEETING = "meeting"
CONTENT_TYPE_DAILY_LOG = "daily_log"
CONTENT_TYPE_PROJECT = "project"
CONTENT_TYPE_COMMENT = "comment"


# ==================== 响应模型 ====================

class NotificationInfo(BaseModel):
    """通知信息"""
    id: int
    recipient_id: int
    sender: Optional[MemberBrief] = None
    notification_type: str
    content_type: str
    content_id: int
    title: str
    message: Optional[str] = None
    link: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UnreadCountResponse(BaseModel):
    """未读数量响应"""
    unread_count: int


class NotificationListResponse(BaseModel):
    """通知列表响应"""
    items: List[NotificationInfo]
    total: int
    unread_count: int


# ==================== 请求模型 ====================

class MarkReadRequest(BaseModel):
    """标记已读请求"""
    notification_ids: List[int] = Field(..., min_length=1, description="通知ID列表")
