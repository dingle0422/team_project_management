"""
会议纪要管理API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.api.deps import get_db, get_current_user, check_owner_or_admin
from app.models.member import Member
from app.models.project import Project
from app.models.meeting import Meeting
from app.models.task import Task
from app.schemas.meeting import (
    MeetingCreate,
    MeetingUpdate,
    MeetingInfo,
    MeetingDetail,
    MeetingBrief,
)
from app.schemas.project import ProjectBrief
from app.schemas.member import MemberBrief
from app.schemas.common import Response, PaginatedResponse, PaginatedData

router = APIRouter()


def convert_meeting_to_info(db: Session, meeting: Meeting) -> MeetingInfo:
    """将Meeting转换为MeetingInfo"""
    # 解析参会人ID列表
    attendee_count = 0
    if meeting.attendee_ids:
        attendee_count = len(meeting.attendee_ids)
    
    # 关联任务数
    task_count = db.query(func.count(Task.id)).filter(
        Task.meeting_id == meeting.id
    ).scalar() or 0
    
    project_brief = None
    if meeting.project:
        project_brief = ProjectBrief(
            id=meeting.project.id,
            name=meeting.project.name,
            code=meeting.project.code,
        )
    
    creator_brief = None
    if meeting.creator:
        creator_brief = MemberBrief(
            id=meeting.creator.id,
            name=meeting.creator.name,
            avatar_url=meeting.creator.avatar_url,
        )
    
    return MeetingInfo(
        id=meeting.id,
        title=meeting.title,
        meeting_date=meeting.meeting_date,
        location=meeting.location,
        summary=meeting.summary,
        content=meeting.content,
        project_id=meeting.project_id,
        project=project_brief,
        attendee_count=attendee_count,
        task_count=task_count,
        created_by=creator_brief,
        created_at=meeting.created_at,
    )


@router.get("", response_model=PaginatedResponse[MeetingInfo])
def list_meetings(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: Optional[int] = Query(None, description="项目ID筛选"),
    keyword: Optional[str] = Query(None, description="搜索关键字"),
):
    """
    获取会议纪要列表
    """
    query = db.query(Meeting).options(
        joinedload(Meeting.project),
        joinedload(Meeting.creator)
    )
    
    # 项目筛选
    if project_id:
        query = query.filter(Meeting.project_id == project_id)
    
    # 关键字搜索
    if keyword:
        query = query.filter(Meeting.title.ilike(f"%{keyword}%"))
    
    total = query.count()
    offset = (page - 1) * page_size
    meetings = query.order_by(Meeting.meeting_date.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[convert_meeting_to_info(db, m) for m in meetings],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/by-project/{project_id}", response_model=Response[list[MeetingBrief]])
def list_project_meetings(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
):
    """
    获取项目的会议纪要简要信息（用于任务关联选择）
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    meetings = db.query(Meeting).filter(
        Meeting.project_id == project_id
    ).order_by(Meeting.meeting_date.desc()).all()
    
    return Response(
        data=[MeetingBrief.model_validate(m) for m in meetings]
    )


@router.get("/{meeting_id}", response_model=Response[MeetingDetail])
def get_meeting(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    meeting_id: int,
):
    """
    获取会议纪要详情
    """
    meeting = db.query(Meeting).options(
        joinedload(Meeting.project),
        joinedload(Meeting.creator)
    ).filter(Meeting.id == meeting_id).first()
    
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # 获取参会人列表
    attendees = []
    if meeting.attendee_ids:
        members = db.query(Member).filter(Member.id.in_(meeting.attendee_ids)).all()
        attendees = [MemberBrief.model_validate(m) for m in members]
    
    # 关联任务数
    task_count = db.query(func.count(Task.id)).filter(
        Task.meeting_id == meeting.id
    ).scalar() or 0
    
    project_brief = None
    if meeting.project:
        project_brief = ProjectBrief(
            id=meeting.project.id,
            name=meeting.project.name,
            code=meeting.project.code,
        )
    
    creator_brief = None
    if meeting.creator:
        creator_brief = MemberBrief(
            id=meeting.creator.id,
            name=meeting.creator.name,
            avatar_url=meeting.creator.avatar_url,
        )
    
    return Response(
        data=MeetingDetail(
            id=meeting.id,
            title=meeting.title,
            meeting_date=meeting.meeting_date,
            location=meeting.location,
            summary=meeting.summary,
            content=meeting.content,
            project_id=meeting.project_id,
            project=project_brief,
            attendee_count=len(attendees),
            task_count=task_count,
            created_by=creator_brief,
            created_at=meeting.created_at,
            attendees=attendees,
        )
    )


@router.post("", response_model=Response[MeetingInfo])
def create_meeting(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    meeting_in: MeetingCreate,
):
    """
    创建会议纪要
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == meeting_in.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    meeting = Meeting(
        project_id=meeting_in.project_id,
        title=meeting_in.title,
        meeting_date=meeting_in.meeting_date,
        location=meeting_in.location,
        summary=meeting_in.summary,
        content=meeting_in.content,
        attendee_ids=meeting_in.attendee_ids,
        created_by=current_user.id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    
    # 重新加载关联数据
    meeting = db.query(Meeting).options(
        joinedload(Meeting.project),
        joinedload(Meeting.creator)
    ).filter(Meeting.id == meeting.id).first()
    
    return Response(data=convert_meeting_to_info(db, meeting))


@router.put("/{meeting_id}", response_model=Response[MeetingInfo])
def update_meeting(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    meeting_id: int,
    meeting_in: MeetingUpdate,
):
    """
    更新会议纪要（仅创建者或管理员）
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # 权限检查：仅创建者或管理员可以更新
    if not check_owner_or_admin(current_user, meeting.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以修改此会议纪要"
        )
    
    # 更新字段
    update_data = meeting_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meeting, field, value)
    
    db.commit()
    db.refresh(meeting)
    
    # 重新加载关联数据
    meeting = db.query(Meeting).options(
        joinedload(Meeting.project),
        joinedload(Meeting.creator)
    ).filter(Meeting.id == meeting.id).first()
    
    return Response(data=convert_meeting_to_info(db, meeting))


@router.delete("/{meeting_id}", response_model=Response)
def delete_meeting(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    meeting_id: int,
):
    """
    删除会议纪要（仅创建者或管理员）
    """
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meeting not found"
        )
    
    # 权限检查：仅创建者或管理员可以删除
    if not check_owner_or_admin(current_user, meeting.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以删除此会议纪要"
        )
    
    # 检查是否有关联任务
    task_count = db.query(func.count(Task.id)).filter(
        Task.meeting_id == meeting_id
    ).scalar()
    if task_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete meeting with {task_count} linked tasks"
        )
    
    db.delete(meeting)
    db.commit()
    
    return Response(message="Meeting deleted successfully")
