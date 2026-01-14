"""
任务管理API
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.api.deps import get_db, get_current_user, check_owner_or_admin
from app.models.member import Member
from app.models.project import Project
from app.models.task import Task, TaskStakeholder, TaskStatusHistory
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskInfo,
    TaskDetail,
    TaskBrief,
    TaskStatusChange,
    TaskStatusHistoryInfo,
    TaskStakeholderAdd,
    TaskStakeholderInfo,
    STATUS_TRANSITIONS,
    TASK_STATUS_DONE,
    TASK_STATUS_CANCELLED,
)
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief
from app.schemas.meeting import MeetingBrief
from app.schemas.common import Response, PaginatedResponse, PaginatedData
from app.services.notification_service import notification_service

router = APIRouter()


def convert_task_to_info(db: Session, task: Task) -> TaskInfo:
    """将Task转换为TaskInfo"""
    # 干系人数量
    stakeholder_count = db.query(func.count(TaskStakeholder.id)).filter(
        TaskStakeholder.task_id == task.id
    ).scalar() or 0
    
    # 子任务数量
    sub_task_count = db.query(func.count(Task.id)).filter(
        Task.parent_task_id == task.id
    ).scalar() or 0
    
    project_brief = None
    if task.project:
        project_brief = ProjectBrief(
            id=task.project.id,
            name=task.project.name,
            code=task.project.code,
        )
    
    meeting_brief = None
    if task.meeting:
        meeting_brief = MeetingBrief(
            id=task.meeting.id,
            title=task.meeting.title,
            meeting_date=task.meeting.meeting_date,
        )
    
    assignee_brief = None
    if task.assignee:
        assignee_brief = MemberBrief(
            id=task.assignee.id,
            name=task.assignee.name,
            avatar_url=task.assignee.avatar_url,
        )
    
    creator_brief = None
    if task.creator:
        creator_brief = MemberBrief(
            id=task.creator.id,
            name=task.creator.name,
            avatar_url=task.creator.avatar_url,
        )
    
    return TaskInfo(
        id=task.id,
        title=task.title,
        description=task.description,
        project_id=task.project_id,
        project=project_brief,
        meeting_id=task.meeting_id,
        meeting=meeting_brief,
        assignee=assignee_brief,
        estimated_hours=task.estimated_hours,
        actual_hours=task.actual_hours,
        status=task.status,
        priority=task.priority,
        task_type=task.task_type,
        start_date=task.start_date,
        due_date=task.due_date,
        parent_task_id=task.parent_task_id,
        sort_order=task.sort_order,
        stakeholder_count=stakeholder_count,
        sub_task_count=sub_task_count,
        created_by=creator_brief,
        created_at=task.created_at,
        completed_at=task.completed_at,
    )


@router.get("", response_model=PaginatedResponse[TaskInfo])
def list_tasks(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    project_id: Optional[int] = Query(None, description="项目ID筛选"),
    assignee_id: Optional[int] = Query(None, description="负责人ID筛选"),
    status: Optional[str] = Query(None, description="状态筛选"),
    priority: Optional[str] = Query(None, description="优先级筛选"),
    keyword: Optional[str] = Query(None, description="关键字搜索"),
    my_tasks: bool = Query(False, description="仅我的任务"),
):
    """
    获取任务列表（所有人可查看）
    """
    query = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.parent_task_id.is_(None))  # 只查询顶级任务
    
    # 项目筛选
    if project_id:
        query = query.filter(Task.project_id == project_id)
    
    # 负责人筛选
    if assignee_id:
        query = query.filter(Task.assignee_id == assignee_id)
    
    # 状态筛选
    if status:
        query = query.filter(Task.status == status)
    
    # 优先级筛选
    if priority:
        query = query.filter(Task.priority == priority)
    
    # 关键字搜索
    if keyword:
        query = query.filter(Task.title.ilike(f"%{keyword}%"))
    
    # 我的任务（负责人是我或我是干系人）
    if my_tasks:
        stakeholder_task_ids = db.query(TaskStakeholder.task_id).filter(
            TaskStakeholder.member_id == current_user.id
        ).subquery()
        query = query.filter(
            or_(
                Task.assignee_id == current_user.id,
                Task.id.in_(stakeholder_task_ids)
            )
        )
    
    total = query.count()
    offset = (page - 1) * page_size
    tasks = query.order_by(Task.sort_order, Task.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[convert_task_to_info(db, t) for t in tasks],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/by-project/{project_id}", response_model=Response[list[TaskInfo]])
def list_project_tasks(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
    status: Optional[str] = Query(None, description="状态筛选"),
):
    """
    获取项目的所有任务（用于看板视图）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    query = db.query(Task).options(
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.project_id == project_id)
    
    if status:
        query = query.filter(Task.status == status)
    
    tasks = query.order_by(Task.sort_order, Task.created_at.desc()).all()
    
    return Response(data=[convert_task_to_info(db, t) for t in tasks])


@router.get("/{task_id}", response_model=Response[TaskDetail])
def get_task(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
):
    """
    获取任务详情
    """
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task_id).first()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 获取干系人
    stakeholders_data = db.query(TaskStakeholder, Member).join(
        Member, TaskStakeholder.member_id == Member.id
    ).filter(TaskStakeholder.task_id == task_id).all()
    
    stakeholders = [
        TaskStakeholderInfo(
            id=ts.id,
            member_id=member.id,
            name=member.name,
            role=ts.role,
            avatar_url=member.avatar_url,
        )
        for ts, member in stakeholders_data
    ]
    
    # 获取状态历史
    history_records = db.query(TaskStatusHistory).options(
        joinedload(TaskStatusHistory.changer)
    ).filter(TaskStatusHistory.task_id == task_id).order_by(
        TaskStatusHistory.changed_at.desc()
    ).all()
    
    status_history = []
    for h in history_records:
        changer_brief = None
        if h.changer:
            changer_brief = MemberBrief(
                id=h.changer.id,
                name=h.changer.name,
                avatar_url=h.changer.avatar_url,
            )
        status_history.append(TaskStatusHistoryInfo(
            id=h.id,
            from_status=h.from_status,
            to_status=h.to_status,
            changed_by=changer_brief,
            comment=h.comment,
            review_type=h.review_type,
            review_result=h.review_result,
            review_feedback=h.review_feedback,
            changed_at=h.changed_at,
        ))
    
    # 获取子任务
    sub_tasks = db.query(Task).filter(Task.parent_task_id == task_id).order_by(Task.sort_order).all()
    
    # 基础信息
    info = convert_task_to_info(db, task)
    
    return Response(
        data=TaskDetail(
            **info.model_dump(),
            stakeholders=stakeholders,
            status_history=status_history,
            sub_tasks=[convert_task_to_info(db, st) for st in sub_tasks],
        )
    )


@router.post("", response_model=Response[TaskInfo])
def create_task(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_in: TaskCreate,
):
    """
    创建任务（所有人可创建）
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 检查会议纪要是否存在（如果指定）
    if task_in.meeting_id:
        from app.models.meeting import Meeting
        meeting = db.query(Meeting).filter(Meeting.id == task_in.meeting_id).first()
        if not meeting:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meeting not found"
            )
    
    # 检查父任务是否存在（如果指定）
    if task_in.parent_task_id:
        parent_task = db.query(Task).filter(Task.id == task_in.parent_task_id).first()
        if not parent_task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent task not found"
            )
    
    # 创建任务
    task = Task(
        project_id=task_in.project_id,
        meeting_id=task_in.meeting_id,
        title=task_in.title,
        description=task_in.description,
        assignee_id=task_in.assignee_id,
        estimated_hours=task_in.estimated_hours,
        priority=task_in.priority,
        task_type=task_in.task_type,
        start_date=task_in.start_date,
        due_date=task_in.due_date,
        parent_task_id=task_in.parent_task_id,
        created_by=current_user.id,
        status="todo",
    )
    db.add(task)
    db.flush()
    
    # 添加干系人
    if task_in.stakeholder_ids:
        for member_id in task_in.stakeholder_ids:
            ts = TaskStakeholder(
                task_id=task.id,
                member_id=member_id,
                role="stakeholder",
            )
            db.add(ts)
    
    # 记录状态历史
    history = TaskStatusHistory(
        task_id=task.id,
        from_status=None,
        to_status="todo",
        changed_by=current_user.id,
        comment="任务创建",
    )
    db.add(history)
    
    # 创建任务分配通知
    if task_in.assignee_id and task_in.assignee_id != current_user.id:
        notification_service.create_assignment_notification(
            db=db,
            assignee_id=task_in.assignee_id,
            sender_id=current_user.id,
            task_id=task.id,
            task_title=task.title,
        )
    
    # 解析描述中的@提及并创建通知
    if task_in.description:
        notification_service.create_mention_notifications(
            db=db,
            text=task_in.description,
            sender_id=current_user.id,
            content_type="task",
            content_id=task.id,
            title=f"在任务中提及了您",
            link=f"/tasks/{task.id}",
        )
    
    db.commit()
    db.refresh(task)
    
    # 重新加载关联数据
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task.id).first()
    
    return Response(data=convert_task_to_info(db, task))


@router.put("/{task_id}", response_model=Response[TaskInfo])
def update_task(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    task_in: TaskUpdate,
):
    """
    更新任务（仅创建者或管理员）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查
    if not check_owner_or_admin(current_user, task.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以修改此任务"
        )
    
    # 更新字段
    update_data = task_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    # 重新加载关联数据
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task.id).first()
    
    return Response(data=convert_task_to_info(db, task))


@router.delete("/{task_id}", response_model=Response)
def delete_task(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
):
    """
    删除任务（仅创建者或管理员）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查
    if not check_owner_or_admin(current_user, task.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以删除此任务"
        )
    
    db.delete(task)
    db.commit()
    
    return Response(message="Task deleted successfully")


# ==================== 状态流转 ====================

@router.post("/{task_id}/status", response_model=Response[TaskInfo])
def change_task_status(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    status_change: TaskStatusChange,
):
    """
    变更任务状态（负责人、干系人、创建者或管理员可操作）
    
    状态流转规则:
    - todo → task_review（提交任务评审）
    - task_review → todo（评审不通过，打回）
    - task_review → in_progress（评审通过，开始开发）
    - in_progress → result_review（提交成果评审）
    - result_review → in_progress（评审不通过，打回）
    - result_review → done（评审通过，完成）
    - 任何状态 → cancelled（取消）
    - cancelled → todo（重新激活）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查：负责人、干系人、创建者或管理员可以变更状态
    is_assignee = task.assignee_id == current_user.id
    is_stakeholder = db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id,
        TaskStakeholder.member_id == current_user.id
    ).first() is not None
    is_creator_or_admin = check_owner_or_admin(current_user, task.created_by)
    
    if not (is_assignee or is_stakeholder or is_creator_or_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有负责人、干系人、创建者或管理员可以变更任务状态"
        )
    
    new_status = status_change.new_status
    current_status = task.status
    
    # 验证状态流转是否合法
    allowed_transitions = STATUS_TRANSITIONS.get(current_status, [])
    if new_status not in allowed_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无法从 '{current_status}' 转换到 '{new_status}'。允许的状态: {allowed_transitions}"
        )
    
    # 确定评审类型
    review_type = None
    if current_status == "task_review":
        review_type = "task_review"
    elif current_status == "result_review":
        review_type = "result_review"
    
    # 更新状态
    task.status = new_status
    
    # 如果完成，记录完成时间
    if new_status == TASK_STATUS_DONE:
        task.completed_at = datetime.utcnow()
    elif new_status != TASK_STATUS_DONE and task.completed_at:
        task.completed_at = None  # 如果从完成状态回退，清除完成时间
    
    # 记录状态历史
    history = TaskStatusHistory(
        task_id=task.id,
        from_status=current_status,
        to_status=new_status,
        changed_by=current_user.id,
        comment=status_change.comment,
        review_type=review_type,
        review_result=status_change.review_result,
        review_feedback=status_change.review_feedback,
    )
    db.add(history)
    
    # 获取需要通知的人员（负责人+干系人）
    notify_member_ids = []
    if task.assignee_id:
        notify_member_ids.append(task.assignee_id)
    if task.created_by:
        notify_member_ids.append(task.created_by)
    stakeholder_ids = [s.member_id for s in db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id
    ).all()]
    notify_member_ids.extend(stakeholder_ids)
    notify_member_ids = list(set(notify_member_ids))
    
    # 提交评审时通知干系人评审
    if new_status in ["task_review", "result_review"]:
        notification_service.create_review_notification(
            db=db,
            reviewer_ids=notify_member_ids,
            sender_id=current_user.id,
            task_id=task.id,
            task_title=task.title,
            review_type=new_status,
        )
    else:
        # 其他状态变更通知
        notification_service.create_status_change_notification(
            db=db,
            recipient_ids=notify_member_ids,
            sender_id=current_user.id,
            task_id=task.id,
            task_title=task.title,
            old_status=current_status,
            new_status=new_status,
        )
    
    # 解析评审意见中的@提及
    if status_change.review_feedback:
        notification_service.create_mention_notifications(
            db=db,
            text=status_change.review_feedback,
            sender_id=current_user.id,
            content_type="task",
            content_id=task.id,
            title=f"在评审意见中提及了您",
            link=f"/tasks/{task.id}",
        )
    
    db.commit()
    db.refresh(task)
    
    # 重新加载关联数据
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task.id).first()
    
    return Response(data=convert_task_to_info(db, task))


# ==================== 干系人管理 ====================

@router.get("/{task_id}/stakeholders", response_model=Response[list[TaskStakeholderInfo]])
def list_task_stakeholders(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
):
    """
    获取任务干系人列表
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    stakeholders_data = db.query(TaskStakeholder, Member).join(
        Member, TaskStakeholder.member_id == Member.id
    ).filter(TaskStakeholder.task_id == task_id).all()
    
    stakeholders = [
        TaskStakeholderInfo(
            id=ts.id,
            member_id=member.id,
            name=member.name,
            role=ts.role,
            avatar_url=member.avatar_url,
        )
        for ts, member in stakeholders_data
    ]
    
    return Response(data=stakeholders)


@router.post("/{task_id}/stakeholders", response_model=Response[TaskStakeholderInfo])
def add_task_stakeholder(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    stakeholder_in: TaskStakeholderAdd,
):
    """
    添加任务干系人（仅创建者或管理员）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查
    if not check_owner_or_admin(current_user, task.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以添加干系人"
        )
    
    # 检查成员是否存在
    member = db.query(Member).filter(Member.id == stakeholder_in.member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 检查是否已是干系人
    existing = db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id,
        TaskStakeholder.member_id == stakeholder_in.member_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该成员已是此任务的干系人"
        )
    
    ts = TaskStakeholder(
        task_id=task_id,
        member_id=stakeholder_in.member_id,
        role=stakeholder_in.role,
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    
    return Response(
        data=TaskStakeholderInfo(
            id=ts.id,
            member_id=member.id,
            name=member.name,
            role=ts.role,
            avatar_url=member.avatar_url,
        )
    )


@router.delete("/{task_id}/stakeholders/{stakeholder_id}", response_model=Response)
def remove_task_stakeholder(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    stakeholder_id: int,
):
    """
    移除任务干系人（仅创建者或管理员）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查
    if not check_owner_or_admin(current_user, task.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以移除干系人"
        )
    
    ts = db.query(TaskStakeholder).filter(TaskStakeholder.id == stakeholder_id).first()
    if not ts or ts.task_id != task_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stakeholder not found"
        )
    
    db.delete(ts)
    db.commit()
    
    return Response(message="Stakeholder removed successfully")
