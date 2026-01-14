"""
通知管理API
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.api.deps import get_db, get_current_user
from app.models.member import Member
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationInfo,
    UnreadCountResponse,
    NotificationListResponse,
    MarkReadRequest,
)
from app.schemas.member import MemberBrief
from app.schemas.common import Response

router = APIRouter()


def convert_notification_to_info(notification: Notification) -> NotificationInfo:
    """将Notification转换为NotificationInfo"""
    sender_brief = None
    if notification.sender:
        sender_brief = MemberBrief(
            id=notification.sender.id,
            name=notification.sender.name,
            avatar_url=notification.sender.avatar_url,
        )
    
    return NotificationInfo(
        id=notification.id,
        recipient_id=notification.recipient_id,
        sender=sender_brief,
        notification_type=notification.notification_type,
        content_type=notification.content_type,
        content_id=notification.content_id,
        title=notification.title,
        message=notification.message,
        link=notification.link,
        is_read=notification.is_read,
        read_at=notification.read_at,
        created_at=notification.created_at,
    )


@router.get("", response_model=Response[NotificationListResponse])
def list_notifications(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False, description="仅未读"),
    notification_type: Optional[str] = Query(None, description="通知类型筛选"),
):
    """
    获取当前用户的通知列表
    """
    query = db.query(Notification).options(
        joinedload(Notification.sender)
    ).filter(Notification.recipient_id == current_user.id)
    
    if unread_only:
        query = query.filter(Notification.is_read == False)
    
    if notification_type:
        query = query.filter(Notification.notification_type == notification_type)
    
    # 总数
    total = query.count()
    
    # 未读数
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).scalar() or 0
    
    # 分页
    offset = (page - 1) * page_size
    notifications = query.order_by(Notification.created_at.desc()).offset(offset).limit(page_size).all()
    
    return Response(
        data=NotificationListResponse(
            items=[convert_notification_to_info(n) for n in notifications],
            total=total,
            unread_count=unread_count,
        )
    )


@router.get("/unread-count", response_model=Response[UnreadCountResponse])
def get_unread_count(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """
    获取未读通知数量（用于右上角提示）
    """
    unread_count = db.query(func.count(Notification.id)).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).scalar() or 0
    
    return Response(data=UnreadCountResponse(unread_count=unread_count))


@router.get("/{notification_id}", response_model=Response[NotificationInfo])
def get_notification(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    notification_id: int,
):
    """
    获取通知详情
    """
    notification = db.query(Notification).options(
        joinedload(Notification.sender)
    ).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    return Response(data=convert_notification_to_info(notification))


@router.put("/{notification_id}/read", response_model=Response[NotificationInfo])
def mark_as_read(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    notification_id: int,
):
    """
    标记单个通知为已读
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    if not notification.is_read:
        notification.is_read = True
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)
    
    # 重新加载关联
    notification = db.query(Notification).options(
        joinedload(Notification.sender)
    ).filter(Notification.id == notification_id).first()
    
    return Response(data=convert_notification_to_info(notification))


@router.put("/read-batch", response_model=Response)
def mark_batch_as_read(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    request: MarkReadRequest,
):
    """
    批量标记通知为已读
    """
    updated = db.query(Notification).filter(
        Notification.id.in_(request.notification_ids),
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).update({
        Notification.is_read: True,
        Notification.read_at: datetime.utcnow()
    }, synchronize_session=False)
    
    db.commit()
    
    return Response(message=f"已标记 {updated} 条通知为已读")


@router.put("/read-all", response_model=Response)
def mark_all_as_read(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
):
    """
    标记所有通知为已读
    """
    updated = db.query(Notification).filter(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    ).update({
        Notification.is_read: True,
        Notification.read_at: datetime.utcnow()
    }, synchronize_session=False)
    
    db.commit()
    
    return Response(message=f"已标记 {updated} 条通知为已读")


@router.delete("/{notification_id}", response_model=Response)
def delete_notification(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    notification_id: int,
):
    """
    删除通知
    """
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.recipient_id == current_user.id
    ).first()
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    db.delete(notification)
    db.commit()
    
    return Response(message="Notification deleted successfully")


@router.delete("/clear-all", response_model=Response)
def clear_all_notifications(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    read_only: bool = Query(True, description="仅清除已读通知"),
):
    """
    清除所有通知
    """
    query = db.query(Notification).filter(
        Notification.recipient_id == current_user.id
    )
    
    if read_only:
        query = query.filter(Notification.is_read == True)
    
    deleted = query.delete(synchronize_session=False)
    db.commit()
    
    return Response(message=f"已清除 {deleted} 条通知")
