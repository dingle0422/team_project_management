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
from app.models.task import Task, TaskStakeholder, TaskStatusHistory, TaskStatusApproval
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
    TaskApprovalAction,
    TaskStatusApprovalInfo,
    PendingApprovalInfo,
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
    # 获取干系人（审核人）
    stakeholders_data = db.query(TaskStakeholder, Member).join(
        Member, TaskStakeholder.member_id == Member.id
    ).filter(TaskStakeholder.task_id == task.id).all()
    
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
    
    stakeholder_count = len(stakeholders)
    
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
        requester_name=task.requester_name,
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
        stakeholders=stakeholders,
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


@router.get("/my", response_model=PaginatedResponse[TaskInfo])
def list_my_tasks(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="状态筛选"),
    exclude_cancelled: bool = Query(True, description="是否排除已取消的任务（用于日报选择等场景）"),
):
    """
    获取我的任务列表（包括分配给我的任务和我创建的任务）
    """
    query = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(
        or_(
            Task.assignee_id == current_user.id,
            Task.created_by == current_user.id
        )
    )
    
    # 排除已取消的任务（默认排除，用于日报选择等场景）
    if exclude_cancelled:
        query = query.filter(Task.status != TASK_STATUS_CANCELLED)
    
    if status:
        query = query.filter(Task.status == status)
    
    total = query.count()
    offset = (page - 1) * page_size
    tasks = query.order_by(Task.due_date.asc().nullslast(), Task.priority.desc()).offset(offset).limit(page_size).all()
    
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
    
    # 获取待审批信息
    pending_approval_info = None
    pending_change = db.query(TaskStatusHistory).filter(
        TaskStatusHistory.task_id == task_id,
        TaskStatusHistory.review_result == "pending"
    ).first()
    
    if pending_change:
        # 获取审批列表
        approvals_data = db.query(TaskStatusApproval, Member).join(
            Member, TaskStatusApproval.stakeholder_id == Member.id
        ).filter(
            TaskStatusApproval.status_change_id == pending_change.id
        ).all()
        
        approvals = [
            TaskStatusApprovalInfo(
                id=approval.id,
                stakeholder_id=member.id,
                stakeholder_name=member.name,
                stakeholder_avatar=member.avatar_url,
                approval_status=approval.approval_status,
                comment=approval.comment,
                approved_at=approval.approved_at,
            )
            for approval, member in approvals_data
        ]
        
        requester_brief = None
        if pending_change.changer:
            requester_brief = MemberBrief(
                id=pending_change.changer.id,
                name=pending_change.changer.name,
                avatar_url=pending_change.changer.avatar_url,
            )
        
        pending_approval_info = PendingApprovalInfo(
            status_change_id=pending_change.id,
            from_status=pending_change.from_status or "",
            to_status=pending_change.to_status,
            requester=requester_brief,
            requested_at=pending_change.changed_at,
            approvals=approvals,
        )
    
    # 基础信息（排除 stakeholders，因为会在 TaskDetail 中单独提供）
    info = convert_task_to_info(db, task)
    
    return Response(
        data=TaskDetail(
            **info.model_dump(exclude={'stakeholders'}),
            stakeholders=stakeholders,
            status_history=status_history,
            sub_tasks=[convert_task_to_info(db, st) for st in sub_tasks],
            pending_approval=pending_approval_info,
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
        requester_name=task_in.requester_name,
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
    
    # 添加干系人并通知
    if task_in.stakeholder_ids:
        for member_id in task_in.stakeholder_ids:
            ts = TaskStakeholder(
                task_id=task.id,
                member_id=member_id,
                role="stakeholder",
            )
            db.add(ts)
        
        # 通知干系人
        notification_service.create_stakeholder_notification(
            db=db,
            stakeholder_ids=task_in.stakeholder_ids,
            sender_id=current_user.id,
            task_id=task.id,
            task_title=task.title,
        )
    
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
    更新任务（创建者或管理员可操作）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查：创建者或管理员可以修改
    is_creator = task.created_by == current_user.id
    is_admin = current_user.role == "admin"
    
    if not (is_creator or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以修改此任务"
        )
    
    # 更新字段（排除 stakeholder_ids，单独处理）
    update_data = task_in.model_dump(exclude_unset=True, exclude={'stakeholder_ids'})
    for field, value in update_data.items():
        setattr(task, field, value)
    
    # 处理审核人更新
    if task_in.stakeholder_ids is not None:
        # 删除现有审核人
        db.query(TaskStakeholder).filter(TaskStakeholder.task_id == task_id).delete()
        # 添加新的审核人
        for member_id in task_in.stakeholder_ids:
            ts = TaskStakeholder(
                task_id=task_id,
                member_id=member_id,
                role="stakeholder",
            )
            db.add(ts)
    
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

@router.patch("/{task_id}/status", response_model=Response[TaskInfo])
def change_task_status(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    status_change: TaskStatusChange,
):
    """
    变更任务状态（仅创建者或管理员可操作）
    
    状态流转规则:
    - todo → task_review（提交任务评审）
    - task_review → todo（评审不通过，打回）
    - task_review → in_progress（评审通过，开始开发）
    - in_progress → result_review（提交成果评审）
    - result_review → in_progress（评审不通过，打回）
    - result_review → done（评审通过，完成）
    - 任何状态 → cancelled（取消）
    - cancelled → todo（重新激活）
    
    当创建者变更状态时，如果有审核人，需要审核人全票通过才能变更
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 权限检查：只有创建者或管理员可以变更状态
    is_creator = task.created_by == current_user.id
    is_admin = current_user.role == "admin"
    
    if not (is_creator or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以变更任务状态"
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
    
    # 获取干系人列表（排除当前用户）
    stakeholders = db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id,
        TaskStakeholder.member_id != current_user.id
    ).all()
    
    # 检查是否有待审批的状态变更
    pending_change = db.query(TaskStatusHistory).join(
        TaskStatusApproval, TaskStatusHistory.id == TaskStatusApproval.status_change_id
    ).filter(
        TaskStatusHistory.task_id == task_id,
        TaskStatusApproval.approval_status == "pending"
    ).first()
    
    if pending_change:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="当前有待审批的状态变更，请等待干系人审批完成"
        )
    
    # 确定评审类型
    review_type = None
    if current_status == "task_review":
        review_type = "task_review"
    elif current_status == "result_review":
        review_type = "result_review"
    
    # 如果是创建者变更状态，且有审核人，需要创建待审批流程
    needs_approval = is_creator and len(stakeholders) > 0 and new_status != TASK_STATUS_CANCELLED
    
    if needs_approval:
        # 创建待审批的状态变更记录（不实际变更状态）
        history = TaskStatusHistory(
            task_id=task.id,
            from_status=current_status,
            to_status=new_status,
            changed_by=current_user.id,
            comment=status_change.comment,
            review_type=review_type,
            review_result="pending",  # 标记为待审批
            review_feedback=status_change.review_feedback,
        )
        db.add(history)
        db.flush()  # 获取history.id
        
        # 为每个干系人创建审批记录
        for stakeholder in stakeholders:
            approval = TaskStatusApproval(
                status_change_id=history.id,
                stakeholder_id=stakeholder.member_id,
                approval_status="pending",
            )
            db.add(approval)
        
        # 通知干系人进行审批
        stakeholder_ids = [s.member_id for s in stakeholders]
        notification_service.create_approval_request_notification(
            db=db,
            stakeholder_ids=stakeholder_ids,
            sender_id=current_user.id,
            task_id=task.id,
            task_title=task.title,
            from_status=current_status,
            to_status=new_status,
        )
        
        db.commit()
        
        # 重新加载关联数据
        task = db.query(Task).options(
            joinedload(Task.project),
            joinedload(Task.meeting),
            joinedload(Task.assignee),
            joinedload(Task.creator)
        ).filter(Task.id == task.id).first()
        
        return Response(
            data=convert_task_to_info(db, task),
            message="状态变更请求已提交，等待干系人审批"
        )
    
    # 无需审批，直接变更状态
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
    all_stakeholder_ids = [s.member_id for s in db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id
    ).all()]
    notify_member_ids.extend(all_stakeholder_ids)
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


@router.post("/{task_id}/cancel-approval", response_model=Response[TaskInfo])
def cancel_approval_request(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
):
    """
    取消待审批的状态变更请求（仅申请人可操作）
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 查找待审批的状态变更记录
    pending_change = db.query(TaskStatusHistory).filter(
        TaskStatusHistory.task_id == task_id,
        TaskStatusHistory.review_result == "pending"
    ).first()
    
    if not pending_change:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到待审批的状态变更请求"
        )
    
    # 权限检查：只有申请人（状态变更的发起人）可以取消
    if pending_change.changed_by != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有申请人可以取消此状态变更请求"
        )
    
    # 标记状态变更为已取消
    pending_change.review_result = "cancelled"
    
    # 删除相关的审批记录
    db.query(TaskStatusApproval).filter(
        TaskStatusApproval.status_change_id == pending_change.id
    ).delete()
    
    # 通知所有干系人申请已取消
    stakeholder_ids = [s.member_id for s in db.query(TaskStakeholder).filter(
        TaskStakeholder.task_id == task_id
    ).all()]
    
    if stakeholder_ids:
        notification_service.create_notification(
            db=db,
            recipient_id=stakeholder_ids[0],  # 先通知第一个
            sender_id=current_user.id,
            notification_type="approval_cancelled",
            content_type="task",
            content_id=task_id,
            title="状态变更申请已取消",
            message=f"任务「{task.title}」的状态变更申请已被 {current_user.name} 取消",
            link=f"/tasks?task={task_id}",
        )
        # 通知其他干系人
        for stakeholder_id in stakeholder_ids[1:]:
            notification_service.create_notification(
                db=db,
                recipient_id=stakeholder_id,
                sender_id=current_user.id,
                notification_type="approval_cancelled",
                content_type="task",
                content_id=task_id,
                title="状态变更申请已取消",
                message=f"任务「{task.title}」的状态变更申请已被 {current_user.name} 取消",
                link=f"/tasks?task={task_id}",
            )
    
    db.commit()
    
    # 重新加载关联数据
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task.id).first()
    
    return Response(
        data=convert_task_to_info(db, task),
        message="状态变更申请已取消"
    )


@router.post("/{task_id}/approve", response_model=Response[TaskInfo])
def approve_status_change(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    task_id: int,
    approval_action: TaskApprovalAction,
):
    """
    干系人审批状态变更
    
    - action: approve（通过）或 reject（拒绝）
    - 所有干系人通过后，状态才会变更
    - 任一干系人拒绝，状态变更取消
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 查找当前用户待审批的记录
    pending_approval = db.query(TaskStatusApproval).join(
        TaskStatusHistory, TaskStatusApproval.status_change_id == TaskStatusHistory.id
    ).filter(
        TaskStatusHistory.task_id == task_id,
        TaskStatusApproval.stakeholder_id == current_user.id,
        TaskStatusApproval.approval_status == "pending"
    ).first()
    
    if not pending_approval:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到待审批的状态变更请求"
        )
    
    # 获取状态变更记录
    status_change_record = db.query(TaskStatusHistory).filter(
        TaskStatusHistory.id == pending_approval.status_change_id
    ).first()
    
    # 更新审批状态
    pending_approval.approval_status = "approved" if approval_action.action == "approve" else "rejected"
    pending_approval.comment = approval_action.comment
    pending_approval.approved_at = datetime.utcnow()
    
    if approval_action.action == "reject":
        # 如果拒绝，标记整个状态变更为失败
        status_change_record.review_result = "rejected"
        
        # 通知创建者状态变更被拒绝
        notification_service.create_notification(
            db=db,
            recipient_id=status_change_record.changed_by,
            sender_id=current_user.id,
            notification_type="approval_rejected",
            content_type="task",
            content_id=task_id,
            title="状态变更被拒绝",
            message=f"任务「{task.title}」的状态变更被 {current_user.name} 拒绝",
            link=f"/tasks/{task_id}",
        )
        
        db.commit()
        
        task = db.query(Task).options(
            joinedload(Task.project),
            joinedload(Task.meeting),
            joinedload(Task.assignee),
            joinedload(Task.creator)
        ).filter(Task.id == task_id).first()
        
        return Response(
            data=convert_task_to_info(db, task),
            message="您已拒绝此状态变更"
        )
    
    # 检查是否所有人都已通过
    all_approvals = db.query(TaskStatusApproval).filter(
        TaskStatusApproval.status_change_id == status_change_record.id
    ).all()
    
    all_approved = all(a.approval_status == "approved" for a in all_approvals)
    
    if all_approved:
        # 全票通过，执行状态变更
        new_status = status_change_record.to_status
        old_status = task.status
        
        task.status = new_status
        status_change_record.review_result = "passed"
        
        # 如果完成，记录完成时间
        if new_status == TASK_STATUS_DONE:
            task.completed_at = datetime.utcnow()
        elif new_status != TASK_STATUS_DONE and task.completed_at:
            task.completed_at = None
        
        # 通知所有相关人员状态变更成功
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
        
        notification_service.create_status_change_notification(
            db=db,
            recipient_ids=notify_member_ids,
            sender_id=status_change_record.changed_by,
            task_id=task.id,
            task_title=task.title,
            old_status=old_status,
            new_status=new_status,
        )
        
        db.commit()
        
        task = db.query(Task).options(
            joinedload(Task.project),
            joinedload(Task.meeting),
            joinedload(Task.assignee),
            joinedload(Task.creator)
        ).filter(Task.id == task_id).first()
        
        return Response(
            data=convert_task_to_info(db, task),
            message="所有干系人已通过，状态变更成功"
        )
    
    db.commit()
    
    task = db.query(Task).options(
        joinedload(Task.project),
        joinedload(Task.meeting),
        joinedload(Task.assignee),
        joinedload(Task.creator)
    ).filter(Task.id == task_id).first()
    
    return Response(
        data=convert_task_to_info(db, task),
        message="审批成功，等待其他干系人审批"
    )


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
