"""
邀请码相关Schema
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ==================== 请求模型 ====================

class InvitationCodeCreate(BaseModel):
    """创建邀请码请求"""
    expires_in_days: Optional[int] = Field(None, ge=1, le=365, description="过期天数，不填则永不过期")


class InvitationCodeValidate(BaseModel):
    """验证邀请码请求"""
    code: str = Field(..., min_length=6, max_length=32, description="邀请码")


# ==================== 响应模型 ====================

class InvitationCodeInfo(BaseModel):
    """邀请码信息"""
    id: int
    code: str
    is_used: bool
    expires_at: Optional[datetime] = None
    created_at: datetime
    used_at: Optional[datetime] = None
    created_by_name: Optional[str] = None
    used_by_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class InvitationCodeBrief(BaseModel):
    """邀请码简要信息（用于生成后返回）"""
    code: str
    expires_at: Optional[datetime] = None
