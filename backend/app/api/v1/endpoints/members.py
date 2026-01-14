"""
成员管理API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.api.deps import get_db, get_current_user, require_admin
from app.models.member import Member
from app.schemas.member import (
    MemberCreate,
    MemberUpdate,
    MemberStatusUpdate,
    MemberInfo,
    MemberBrief,
)
from app.schemas.common import Response, PaginatedResponse, PaginatedData
from app.core.security import get_password_hash

router = APIRouter()


@router.get("", response_model=PaginatedResponse[MemberInfo])
def list_members(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    keyword: Optional[str] = Query(None, description="搜索关键字"),
    role: Optional[str] = Query(None, description="角色筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
):
    """
    获取成员列表
    """
    query = db.query(Member)
    
    # 关键字搜索
    if keyword:
        query = query.filter(
            or_(
                Member.name.ilike(f"%{keyword}%"),
                Member.email.ilike(f"%{keyword}%"),
            )
        )
    
    # 角色筛选
    if role:
        query = query.filter(Member.role == role)
    
    # 状态筛选
    if status:
        query = query.filter(Member.status == status)
    
    # 计算总数
    total = query.count()
    
    # 分页
    offset = (page - 1) * page_size
    members = query.order_by(Member.created_at.desc()).offset(offset).limit(page_size).all()
    
    # 计算总页数
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[MemberInfo.model_validate(m) for m in members],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/all", response_model=Response[list[MemberBrief]])
def list_all_members(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    active_only: bool = Query(True, description="仅活跃成员"),
):
    """
    获取所有成员简要信息（用于下拉选择）
    """
    query = db.query(Member)
    if active_only:
        query = query.filter(Member.status == "active")
    
    members = query.order_by(Member.name).all()
    
    return Response(data=[MemberBrief.model_validate(m) for m in members])


@router.get("/{member_id}", response_model=Response[MemberInfo])
def get_member(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    member_id: int,
):
    """
    获取成员详情
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    return Response(data=MemberInfo.model_validate(member))


@router.post("", response_model=Response[MemberInfo])
def create_member(
    *,
    db: Session = Depends(get_db),
    admin: Member = Depends(require_admin),
    member_in: MemberCreate,
):
    """
    创建成员（需要管理员权限）
    """
    # 检查邮箱是否已存在
    existing = db.query(Member).filter(Member.email == member_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    member = Member(
        name=member_in.name,
        email=member_in.email,
        password_hash=get_password_hash(member_in.password),
        job_title=member_in.job_title,
        phone=member_in.phone,
        avatar_url=member_in.avatar_url,
        role=member_in.role,
        status="active",
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    return Response(data=MemberInfo.model_validate(member))


@router.put("/{member_id}", response_model=Response[MemberInfo])
def update_member(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    member_id: int,
    member_in: MemberUpdate,
):
    """
    更新成员信息
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 权限检查：只能更新自己的信息，除非是管理员
    if current_user.id != member_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied"
        )
    
    # 如果不是管理员，不允许修改角色
    if current_user.role != "admin" and member_in.role is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can change roles"
        )
    
    # 更新字段
    update_data = member_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)
    
    db.commit()
    db.refresh(member)
    
    return Response(data=MemberInfo.model_validate(member))


@router.patch("/{member_id}/status", response_model=Response[MemberInfo])
def update_member_status(
    *,
    db: Session = Depends(get_db),
    admin: Member = Depends(require_admin),
    member_id: int,
    status_in: MemberStatusUpdate,
):
    """
    更新成员状态（需要管理员权限）
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 不能禁用自己
    if admin.id == member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own status"
        )
    
    member.status = status_in.status
    db.commit()
    db.refresh(member)
    
    return Response(data=MemberInfo.model_validate(member))


@router.delete("/{member_id}", response_model=Response)
def delete_member(
    *,
    db: Session = Depends(get_db),
    admin: Member = Depends(require_admin),
    member_id: int,
):
    """
    删除成员（需要管理员权限）
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 不能删除自己
    if admin.id == member_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    db.delete(member)
    db.commit()
    
    return Response(message="Member deleted successfully")
