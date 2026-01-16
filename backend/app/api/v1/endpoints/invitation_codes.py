"""
邀请码相关API
"""
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.deps import get_db, get_current_user
from app.models.member import Member
from app.models.invitation_code import InvitationCode
from app.schemas.invitation_code import (
    InvitationCodeCreate,
    InvitationCodeInfo,
    InvitationCodeBrief,
    InvitationCodeValidate,
)
from app.schemas.common import Response, PaginatedResponse

router = APIRouter()


def generate_invitation_code() -> str:
    """生成一个唯一的邀请码"""
    return secrets.token_urlsafe(12)[:16].upper()


@router.post("/generate", response_model=Response[InvitationCodeBrief])
def generate_code(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    code_in: InvitationCodeCreate = None,
):
    """
    生成邀请码（仅管理员可用）
    """
    # 检查权限
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can generate invitation codes"
        )
    
    # 生成唯一的邀请码
    max_attempts = 10
    for _ in range(max_attempts):
        code = generate_invitation_code()
        existing = db.query(InvitationCode).filter(InvitationCode.code == code).first()
        if not existing:
            break
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate unique invitation code"
        )
    
    # 计算过期时间
    expires_at = None
    if code_in and code_in.expires_in_days:
        expires_at = datetime.utcnow() + timedelta(days=code_in.expires_in_days)
    
    # 创建邀请码
    invitation_code = InvitationCode(
        code=code,
        created_by_id=current_user.id,
        expires_at=expires_at,
    )
    db.add(invitation_code)
    db.commit()
    db.refresh(invitation_code)
    
    return Response(
        data=InvitationCodeBrief(code=code, expires_at=expires_at),
        message="邀请码生成成功"
    )


@router.get("", response_model=PaginatedResponse[InvitationCodeInfo])
def list_codes(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = 1,
    page_size: int = 20,
    is_used: bool = None,
):
    """
    获取邀请码列表（仅管理员可用）
    """
    # 检查权限
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can view invitation codes"
        )
    
    query = db.query(InvitationCode)
    
    # 筛选条件
    if is_used is not None:
        query = query.filter(InvitationCode.is_used == is_used)
    
    # 分页
    total = query.count()
    codes = query.order_by(InvitationCode.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    # 转换为响应格式
    items = []
    for code in codes:
        items.append(InvitationCodeInfo(
            id=code.id,
            code=code.code,
            is_used=code.is_used,
            expires_at=code.expires_at,
            created_at=code.created_at,
            used_at=code.used_at,
            created_by_name=code.created_by.name if code.created_by else None,
            used_by_name=code.used_by.name if code.used_by else None,
        ))
    
    return PaginatedResponse(
        data={
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }
    )


@router.post("/validate", response_model=Response[dict])
def validate_code(
    *,
    db: Session = Depends(get_db),
    code_in: InvitationCodeValidate,
):
    """
    验证邀请码是否有效（公开接口，用于注册前验证）
    """
    invitation_code = db.query(InvitationCode).filter(
        InvitationCode.code == code_in.code.upper()
    ).first()
    
    if not invitation_code:
        return Response(
            data={"valid": False, "reason": "邀请码不存在"},
            message="邀请码无效"
        )
    
    if invitation_code.is_used:
        return Response(
            data={"valid": False, "reason": "邀请码已被使用"},
            message="邀请码无效"
        )
    
    if invitation_code.expires_at and invitation_code.expires_at < datetime.utcnow():
        return Response(
            data={"valid": False, "reason": "邀请码已过期"},
            message="邀请码无效"
        )
    
    return Response(
        data={"valid": True},
        message="邀请码有效"
    )


@router.delete("/{code_id}", response_model=Response)
def delete_code(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    code_id: int,
):
    """
    删除邀请码（仅管理员可用，只能删除未使用的邀请码）
    """
    # 检查权限
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete invitation codes"
        )
    
    invitation_code = db.query(InvitationCode).filter(InvitationCode.id == code_id).first()
    
    if not invitation_code:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation code not found"
        )
    
    if invitation_code.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete used invitation code"
        )
    
    db.delete(invitation_code)
    db.commit()
    
    return Response(message="邀请码删除成功")
