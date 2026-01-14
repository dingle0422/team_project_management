"""
认证相关API
"""
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.member import Member
from app.schemas.member import (
    MemberCreate,
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
    member_in: MemberCreate,
):
    """
    注册新用户
    """
    # 检查邮箱是否已存在
    existing_user = db.query(Member).filter(Member.email == member_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # 创建用户
    user = Member(
        name=member_in.name,
        email=member_in.email,
        password_hash=get_password_hash(member_in.password),
        job_title=member_in.job_title,
        phone=member_in.phone,
        avatar_url=member_in.avatar_url,
        role=member_in.role,
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return Response(data=MemberInfo.model_validate(user))


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
        data={"sub": str(user.id)},
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
        data={"sub": str(user.id)},
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


@router.post("/change-password", response_model=Response)
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
