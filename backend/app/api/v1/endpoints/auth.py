"""
认证相关API
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.member import Member
from app.models.invitation_code import InvitationCode
from app.schemas.member import (
    MemberCreate,
    MemberRegister,
    MemberInfo,
    LoginRequest,
    LoginResponse,
    Token,
    PasswordChange,
)
from app.schemas.common import Response

router = APIRouter()


@router.post("/register", response_model=Response[MemberInfo])
def register(
    *,
    db: Session = Depends(get_db),
    member_in: MemberRegister,
):
    """
    用户注册（需要有效的邀请码）
    """
    # 验证邀请码
    invitation_code = db.query(InvitationCode).filter(
        InvitationCode.code == member_in.invitation_code.upper()
    ).first()
    
    if not invitation_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邀请码不存在"
        )
    
    if invitation_code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邀请码已被使用"
        )
    
    if invitation_code.expires_at and invitation_code.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="邀请码已过期"
        )
    
    # 检查邮箱是否已存在
    existing_user = db.query(Member).filter(Member.email == member_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该邮箱已被注册"
        )
    
    # 创建用户
    user = Member(
        name=member_in.name,
        email=member_in.email,
        password_hash=get_password_hash(member_in.password),
        job_title=member_in.job_title,
        phone=member_in.phone,
        role="member",  # 注册用户默认为普通成员
        status="active",
    )
    db.add(user)
    db.flush()  # 获取用户ID
    
    # 标记邀请码为已使用
    invitation_code.is_used = True
    invitation_code.used_by_id = user.id
    invitation_code.used_at = datetime.utcnow()
    
    db.commit()
    db.refresh(user)
    
    return Response(data=MemberInfo.model_validate(user), message="注册成功")


@router.post("/login", response_model=LoginResponse)
def login(
    *,
    db: Session = Depends(get_db),
    login_data: LoginRequest,
):
    """
    用户登录
    """
    user = db.query(Member).filter(Member.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    # 创建访问令牌
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=MemberInfo.model_validate(user),
    )


@router.post("/login/form", response_model=Token)
def login_form(
    db: Session = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    """
    表单登录 (OAuth2兼容)
    """
    user = db.query(Member).filter(Member.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )
    
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=access_token_expires,
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.get("/me", response_model=Response[MemberInfo])
def get_current_user_info(
    current_user: Member = Depends(get_current_user),
):
    """
    获取当前用户信息
    """
    return Response(data=MemberInfo.model_validate(current_user))


@router.put("/change-password", response_model=Response)
def change_password(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    password_data: PasswordChange,
):
    """
    修改密码
    """
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect old password",
        )
    
    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    
    return Response(message="Password changed successfully")
