"""
成员相关Schema
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


# ==================== 基础模型 ====================

class MemberBase(BaseModel):
    """成员基础信息"""
    name: str = Field(..., min_length=1, max_length=50, description="姓名")
    email: EmailStr = Field(..., description="邮箱")
    job_title: Optional[str] = Field(None, max_length=100, description="职位")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")
    avatar_url: Optional[str] = Field(None, description="头像URL")


class MemberCreate(MemberBase):
    """创建成员"""
    password: str = Field(..., min_length=6, description="密码")
    role: str = Field("member", description="角色: admin, manager, member")


class MemberRegister(BaseModel):
    """用户注册"""
    name: str = Field(..., min_length=1, max_length=50, description="姓名")
    email: EmailStr = Field(..., description="邮箱")
    password: str = Field(..., min_length=6, description="密码")
    invitation_code: str = Field(..., min_length=6, max_length=32, description="邀请码")
    job_title: Optional[str] = Field(None, max_length=100, description="职位")
    phone: Optional[str] = Field(None, max_length=20, description="手机号")


class MemberUpdate(BaseModel):
    """更新成员"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    job_title: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = None
    role: Optional[str] = None


class MemberStatusUpdate(BaseModel):
    """更新成员状态"""
    status: str = Field(..., description="状态: active, inactive")


# ==================== 响应模型 ====================

class MemberInfo(MemberBase):
    """成员信息响应"""
    id: int
    role: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class MemberBrief(BaseModel):
    """成员简要信息"""
    id: int
    name: str
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== 认证相关 ====================

class Token(BaseModel):
    """令牌响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """令牌数据"""
    sub: Optional[str] = None


class LoginRequest(BaseModel):
    """登录请求"""
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    """登录响应"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: MemberInfo


class PasswordChange(BaseModel):
    """修改密码"""
    old_password: str
    new_password: str = Field(..., min_length=6)
