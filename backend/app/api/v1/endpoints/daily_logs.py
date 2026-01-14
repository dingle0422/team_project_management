"""
日报/工时记录API
"""
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.api.deps import get_db, get_current_user, check_owner_or_admin
from app.models.member import Member
from app.models.project import Project
from app.models.task import Task
from app.models.daily_log import DailyWorkLog, DailySummary
from app.schemas.daily_log import (
    WorkLogCreate,
    WorkLogUpdate,
    WorkLogInfo,
    DailySummaryCreate,
    DailySummaryInfo,
    DailyReportInfo,
    DailyReportListItem,
    QuickDailyReportCreate,
    WorkHoursSummary,
)
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief
from app.schemas.task import TaskBrief
from app.schemas.common import Response, PaginatedResponse, PaginatedData

router = APIRouter()


def convert_worklog_to_info(log: DailyWorkLog) -> WorkLogInfo:
    """将DailyWorkLog转换为WorkLogInfo"""
    member_brief = None
    if log.member:
        member_brief = MemberBrief(
            id=log.member.id,
            name=log.member.name,
            avatar_url=log.member.avatar_url,
        )
    
    task_brief = None
    if log.task:
        task_brief = TaskBrief(
            id=log.task.id,
            title=log.task.title,
            status=log.task.status,
            priority=log.task.priority,
        )
    
    project_brief = None
    if log.project:
        project_brief = ProjectBrief(
            id=log.project.id,
            name=log.project.name,
            code=log.project.code,
        )
    
    return WorkLogInfo(
        id=log.id,
        member_id=log.member_id,
        member=member_brief,
        task_id=log.task_id,
        task=task_brief,
        project_id=log.project_id,
        project=project_brief,
        work_date=log.work_date,
        hours=log.hours,
        description=log.description,
        work_type=log.work_type,
        created_at=log.created_at,
    )


# ==================== 工时记录 ====================

@router.get("/logs", response_model=PaginatedResponse[WorkLogInfo])
def list_work_logs(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    member_id: Optional[int] = Query(None, description="成员ID筛选"),
    project_id: Optional[int] = Query(None, description="项目ID筛选"),
    task_id: Optional[int] = Query(None, description="任务ID筛选"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    my_logs: bool = Query(False, description="仅我的记录"),
):
    """
    获取工时记录列表
    """
    query = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.member),
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    )
    
    if my_logs:
        query = query.filter(DailyWorkLog.member_id == current_user.id)
    elif member_id:
        query = query.filter(DailyWorkLog.member_id == member_id)
    
    if project_id:
        query = query.filter(DailyWorkLog.project_id == project_id)
    
    if task_id:
        query = query.filter(DailyWorkLog.task_id == task_id)
    
    if start_date:
        query = query.filter(DailyWorkLog.work_date >= start_date)
    
    if end_date:
        query = query.filter(DailyWorkLog.work_date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    logs = query.order_by(DailyWorkLog.work_date.desc(), DailyWorkLog.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[convert_worklog_to_info(log) for log in logs],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.post("/logs", response_model=Response[WorkLogInfo])
def create_work_log(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    log_in: WorkLogCreate,
):
    """
    创建工时记录（只能记录自己的工时）
    """
    # 检查任务是否存在
    task = db.query(Task).filter(Task.id == log_in.task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    
    # 创建工时记录
    log = DailyWorkLog(
        member_id=current_user.id,
        task_id=log_in.task_id,
        project_id=task.project_id,
        work_date=log_in.work_date,
        hours=log_in.hours,
        description=log_in.description,
        work_type=log_in.work_type,
    )
    db.add(log)
    
    # 更新任务的实际工时
    task.actual_hours = (task.actual_hours or Decimal("0")) + log_in.hours
    
    db.commit()
    db.refresh(log)
    
    # 重新加载关联数据
    log = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.member),
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    ).filter(DailyWorkLog.id == log.id).first()
    
    return Response(data=convert_worklog_to_info(log))


@router.put("/logs/{log_id}", response_model=Response[WorkLogInfo])
def update_work_log(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    log_id: int,
    log_in: WorkLogUpdate,
):
    """
    更新工时记录（只能更新自己的记录）
    """
    log = db.query(DailyWorkLog).filter(DailyWorkLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )
    
    # 权限检查：只能更新自己的记录，管理员除外
    if log.member_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能更新自己的工时记录"
        )
    
    # 记录旧的工时
    old_hours = log.hours
    
    # 更新字段
    update_data = log_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(log, field, value)
    
    # 如果工时变化，更新任务的实际工时
    if "hours" in update_data:
        task = db.query(Task).filter(Task.id == log.task_id).first()
        if task:
            task.actual_hours = (task.actual_hours or Decimal("0")) - old_hours + log.hours
    
    db.commit()
    db.refresh(log)
    
    # 重新加载关联数据
    log = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.member),
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    ).filter(DailyWorkLog.id == log.id).first()
    
    return Response(data=convert_worklog_to_info(log))


@router.delete("/logs/{log_id}", response_model=Response)
def delete_work_log(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    log_id: int,
):
    """
    删除工时记录（只能删除自己的记录）
    """
    log = db.query(DailyWorkLog).filter(DailyWorkLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work log not found"
        )
    
    # 权限检查
    if log.member_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能删除自己的工时记录"
        )
    
    # 更新任务的实际工时
    task = db.query(Task).filter(Task.id == log.task_id).first()
    if task:
        task.actual_hours = max(Decimal("0"), (task.actual_hours or Decimal("0")) - log.hours)
    
    db.delete(log)
    db.commit()
    
    return Response(message="Work log deleted successfully")


# ==================== 每日总结 ====================

@router.get("/summaries", response_model=PaginatedResponse[DailySummaryInfo])
def list_daily_summaries(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    member_id: Optional[int] = Query(None, description="成员ID筛选"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    my_summaries: bool = Query(False, description="仅我的总结"),
):
    """
    获取每日总结列表
    """
    query = db.query(DailySummary)
    
    if my_summaries:
        query = query.filter(DailySummary.member_id == current_user.id)
    elif member_id:
        query = query.filter(DailySummary.member_id == member_id)
    
    if start_date:
        query = query.filter(DailySummary.summary_date >= start_date)
    
    if end_date:
        query = query.filter(DailySummary.summary_date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    summaries = query.order_by(DailySummary.summary_date.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[DailySummaryInfo.model_validate(s) for s in summaries],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.post("/summaries", response_model=Response[DailySummaryInfo])
def create_or_update_daily_summary(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    summary_in: DailySummaryCreate,
):
    """
    创建或更新每日总结（每人每天只能有一条）
    """
    # 查找是否已存在
    existing = db.query(DailySummary).filter(
        DailySummary.member_id == current_user.id,
        DailySummary.summary_date == summary_in.summary_date
    ).first()
    
    if existing:
        # 更新
        existing.problems = summary_in.problems
        existing.tomorrow_plan = summary_in.tomorrow_plan
        existing.notes = summary_in.notes
        db.commit()
        db.refresh(existing)
        return Response(data=DailySummaryInfo.model_validate(existing))
    else:
        # 创建
        summary = DailySummary(
            member_id=current_user.id,
            summary_date=summary_in.summary_date,
            problems=summary_in.problems,
            tomorrow_plan=summary_in.tomorrow_plan,
            notes=summary_in.notes,
        )
        db.add(summary)
        db.commit()
        db.refresh(summary)
        return Response(data=DailySummaryInfo.model_validate(summary))


# ==================== 日报聚合视图 ====================

@router.get("/reports", response_model=PaginatedResponse[DailyReportListItem])
def list_daily_reports(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    member_id: Optional[int] = Query(None, description="成员ID筛选"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
):
    """
    获取日报列表（聚合视图）
    """
    # 按成员和日期分组查询工时记录
    query = db.query(
        DailyWorkLog.member_id,
        DailyWorkLog.work_date,
        func.sum(DailyWorkLog.hours).label("total_hours"),
        func.count(DailyWorkLog.id).label("log_count")
    ).group_by(DailyWorkLog.member_id, DailyWorkLog.work_date)
    
    if member_id:
        query = query.filter(DailyWorkLog.member_id == member_id)
    
    if start_date:
        query = query.filter(DailyWorkLog.work_date >= start_date)
    
    if end_date:
        query = query.filter(DailyWorkLog.work_date <= end_date)
    
    # 获取总数
    subquery = query.subquery()
    total = db.query(func.count()).select_from(subquery).scalar()
    
    # 分页
    offset = (page - 1) * page_size
    results = query.order_by(DailyWorkLog.work_date.desc()).offset(offset).limit(page_size).all()
    
    # 构建响应
    items = []
    for r in results:
        member = db.query(Member).filter(Member.id == r.member_id).first()
        
        # 检查是否有总结
        has_summary = db.query(DailySummary).filter(
            DailySummary.member_id == r.member_id,
            DailySummary.summary_date == r.work_date
        ).first() is not None
        
        items.append(DailyReportListItem(
            report_date=r.work_date,
            member=MemberBrief(
                id=member.id,
                name=member.name,
                avatar_url=member.avatar_url,
            ),
            total_hours=r.total_hours,
            work_log_count=r.log_count,
            has_summary=has_summary,
        ))
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/reports/{member_id}/{report_date}", response_model=Response[DailyReportInfo])
def get_daily_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    member_id: int,
    report_date: date,
):
    """
    获取某人某天的日报详情
    """
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 获取工时记录
    logs = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.member),
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    ).filter(
        DailyWorkLog.member_id == member_id,
        DailyWorkLog.work_date == report_date
    ).all()
    
    # 获取总结
    summary = db.query(DailySummary).filter(
        DailySummary.member_id == member_id,
        DailySummary.summary_date == report_date
    ).first()
    
    total_hours = sum(log.hours for log in logs)
    
    return Response(
        data=DailyReportInfo(
            report_date=report_date,
            member=MemberBrief(
                id=member.id,
                name=member.name,
                avatar_url=member.avatar_url,
            ),
            total_hours=total_hours,
            work_logs=[convert_worklog_to_info(log) for log in logs],
            summary=DailySummaryInfo.model_validate(summary) if summary else None,
        )
    )


# ==================== 快速日报提交 ====================

@router.post("/quick-submit", response_model=Response[DailyReportInfo])
def submit_quick_daily_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    report_in: QuickDailyReportCreate,
):
    """
    快速提交日报（工时记录+总结一起提交）
    """
    # 创建工时记录
    logs = []
    for log_data in report_in.work_logs:
        task = db.query(Task).filter(Task.id == log_data.task_id).first()
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Task {log_data.task_id} not found"
            )
        
        log = DailyWorkLog(
            member_id=current_user.id,
            task_id=log_data.task_id,
            project_id=task.project_id,
            work_date=report_in.report_date,
            hours=log_data.hours,
            description=log_data.description,
            work_type=log_data.work_type,
        )
        db.add(log)
        
        # 更新任务实际工时
        task.actual_hours = (task.actual_hours or Decimal("0")) + log_data.hours
        
        logs.append(log)
    
    # 创建或更新总结
    summary = None
    if report_in.problems or report_in.tomorrow_plan or report_in.notes:
        existing_summary = db.query(DailySummary).filter(
            DailySummary.member_id == current_user.id,
            DailySummary.summary_date == report_in.report_date
        ).first()
        
        if existing_summary:
            existing_summary.problems = report_in.problems
            existing_summary.tomorrow_plan = report_in.tomorrow_plan
            existing_summary.notes = report_in.notes
            summary = existing_summary
        else:
            summary = DailySummary(
                member_id=current_user.id,
                summary_date=report_in.report_date,
                problems=report_in.problems,
                tomorrow_plan=report_in.tomorrow_plan,
                notes=report_in.notes,
            )
            db.add(summary)
    
    db.commit()
    
    # 重新加载
    logs = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.member),
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    ).filter(
        DailyWorkLog.member_id == current_user.id,
        DailyWorkLog.work_date == report_in.report_date
    ).all()
    
    total_hours = sum(log.hours for log in logs)
    
    return Response(
        data=DailyReportInfo(
            report_date=report_in.report_date,
            member=MemberBrief(
                id=current_user.id,
                name=current_user.name,
                avatar_url=current_user.avatar_url,
            ),
            total_hours=total_hours,
            work_logs=[convert_worklog_to_info(log) for log in logs],
            summary=DailySummaryInfo.model_validate(summary) if summary else None,
        )
    )


# ==================== 工时统计 ====================

@router.get("/stats", response_model=Response[WorkHoursSummary])
def get_work_hours_stats(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    member_id: Optional[int] = Query(None, description="成员ID"),
    start_date: date = Query(..., description="开始日期"),
    end_date: date = Query(..., description="结束日期"),
):
    """
    获取工时统计
    """
    target_member_id = member_id or current_user.id
    
    base_query = db.query(DailyWorkLog).filter(
        DailyWorkLog.member_id == target_member_id,
        DailyWorkLog.work_date >= start_date,
        DailyWorkLog.work_date <= end_date
    )
    
    # 总工时
    total_hours = base_query.with_entities(
        func.sum(DailyWorkLog.hours)
    ).scalar() or Decimal("0")
    
    # 按项目统计
    by_project_query = db.query(
        DailyWorkLog.project_id,
        func.sum(DailyWorkLog.hours).label("hours")
    ).filter(
        DailyWorkLog.member_id == target_member_id,
        DailyWorkLog.work_date >= start_date,
        DailyWorkLog.work_date <= end_date
    ).group_by(DailyWorkLog.project_id).all()
    
    by_project = []
    for p_id, hours in by_project_query:
        project = db.query(Project).filter(Project.id == p_id).first()
        by_project.append({
            "project_id": p_id,
            "project_name": project.name if project else "Unknown",
            "hours": float(hours),
        })
    
    # 按工作类型统计
    by_type_query = db.query(
        DailyWorkLog.work_type,
        func.sum(DailyWorkLog.hours).label("hours")
    ).filter(
        DailyWorkLog.member_id == target_member_id,
        DailyWorkLog.work_date >= start_date,
        DailyWorkLog.work_date <= end_date
    ).group_by(DailyWorkLog.work_type).all()
    
    by_task_type = [
        {"work_type": wt or "other", "hours": float(hours)}
        for wt, hours in by_type_query
    ]
    
    # 按日期统计
    by_date_query = db.query(
        DailyWorkLog.work_date,
        func.sum(DailyWorkLog.hours).label("hours")
    ).filter(
        DailyWorkLog.member_id == target_member_id,
        DailyWorkLog.work_date >= start_date,
        DailyWorkLog.work_date <= end_date
    ).group_by(DailyWorkLog.work_date).order_by(DailyWorkLog.work_date).all()
    
    by_date = [
        {"date": d.isoformat(), "hours": float(hours)}
        for d, hours in by_date_query
    ]
    
    return Response(
        data=WorkHoursSummary(
            total_hours=total_hours,
            by_project=by_project,
            by_task_type=by_task_type,
            by_date=by_date,
        )
    )
