"""
周报管理API
"""
from datetime import date, timedelta
from typing import Optional
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_

from app.api.deps import get_db, get_current_user, check_owner_or_admin
from app.models.member import Member
from app.models.project import Project
from app.models.task import Task, TaskStatusHistory
from app.models.meeting import Meeting
from app.models.daily_log import DailyWorkLog, DailySummary
from app.models.weekly_report import WeeklyReport
from app.schemas.weekly_report import (
    PersonalWeeklyReportRequest,
    ProjectWeeklyReportRequest,
    WeeklyReportUpdate,
    WeeklyReportInfo,
    WeeklyReportDetail,
    WeeklyReportListItem,
    PersonalWeeklyData,
    ProjectWeeklyData,
    TaskSummaryForReport,
    WorkLogSummaryForReport,
    DailySummaryForReport,
)
from app.schemas.member import MemberBrief
from app.schemas.project import ProjectBrief
from app.schemas.common import Response, PaginatedResponse, PaginatedData
from app.services.ai_service import ai_service
from app.core.config import settings

router = APIRouter()


def convert_report_to_info(report: WeeklyReport) -> WeeklyReportInfo:
    """将WeeklyReport转换为WeeklyReportInfo"""
    member_brief = None
    if report.member:
        member_brief = MemberBrief(
            id=report.member.id,
            name=report.member.name,
            avatar_url=report.member.avatar_url,
        )
    
    project_brief = None
    if report.project:
        project_brief = ProjectBrief(
            id=report.project.id,
            name=report.project.name,
            code=report.project.code,
        )
    
    reviewer_brief = None
    if report.reviewer:
        reviewer_brief = MemberBrief(
            id=report.reviewer.id,
            name=report.reviewer.name,
            avatar_url=report.reviewer.avatar_url,
        )
    
    return WeeklyReportInfo(
        id=report.id,
        report_type=report.report_type,
        member=member_brief,
        project=project_brief,
        week_start=report.week_start,
        week_end=report.week_end,
        summary=report.summary,
        achievements=report.achievements,
        issues=report.issues,
        next_week_plan=report.next_week_plan,
        edited_summary=report.edited_summary,
        edited_achievements=report.edited_achievements,
        edited_issues=report.edited_issues,
        edited_next_week_plan=report.edited_next_week_plan,
        ai_model=report.ai_model,
        is_reviewed=report.is_reviewed,
        reviewer=reviewer_brief,
        reviewed_at=report.reviewed_at,
        generated_at=report.generated_at,
    )


# ==================== 周报列表 ====================

@router.get("", response_model=PaginatedResponse[WeeklyReportListItem])
def list_weekly_reports(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    report_type: Optional[str] = Query(None, description="类型: personal, project"),
    member_id: Optional[int] = Query(None, description="成员ID筛选"),
    project_id: Optional[int] = Query(None, description="项目ID筛选"),
    my_reports: bool = Query(False, description="仅我的周报"),
):
    """
    获取周报列表
    """
    query = db.query(WeeklyReport).options(
        joinedload(WeeklyReport.member),
        joinedload(WeeklyReport.project)
    )
    
    if report_type:
        query = query.filter(WeeklyReport.report_type == report_type)
    
    if my_reports:
        query = query.filter(WeeklyReport.member_id == current_user.id)
    elif member_id:
        query = query.filter(WeeklyReport.member_id == member_id)
    
    if project_id:
        query = query.filter(WeeklyReport.project_id == project_id)
    
    total = query.count()
    offset = (page - 1) * page_size
    reports = query.order_by(WeeklyReport.week_start.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    items = []
    for r in reports:
        member_brief = None
        if r.member:
            member_brief = MemberBrief(id=r.member.id, name=r.member.name, avatar_url=r.member.avatar_url)
        project_brief = None
        if r.project:
            project_brief = ProjectBrief(id=r.project.id, name=r.project.name, code=r.project.code)
        
        items.append(WeeklyReportListItem(
            id=r.id,
            report_type=r.report_type,
            member=member_brief,
            project=project_brief,
            week_start=r.week_start,
            week_end=r.week_end,
            is_reviewed=r.is_reviewed,
            generated_at=r.generated_at,
        ))
    
    return PaginatedResponse(
        data=PaginatedData(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/{report_id}", response_model=Response[WeeklyReportDetail])
def get_weekly_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    report_id: int,
):
    """
    获取周报详情
    """
    report = db.query(WeeklyReport).options(
        joinedload(WeeklyReport.member),
        joinedload(WeeklyReport.project),
        joinedload(WeeklyReport.reviewer)
    ).filter(WeeklyReport.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly report not found"
        )
    
    info = convert_report_to_info(report)
    
    return Response(
        data=WeeklyReportDetail(
            **info.model_dump(),
            raw_data=report.raw_data,
        )
    )


# ==================== 生成个人周报 ====================

@router.post("/generate/personal", response_model=Response[WeeklyReportInfo])
def generate_personal_weekly_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    request: PersonalWeeklyReportRequest,
):
    """
    生成个人周报
    """
    target_member_id = request.member_id or current_user.id
    
    # 权限检查：只能生成自己的周报，除非是管理员
    if target_member_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只能生成自己的周报"
        )
    
    # 获取目标成员
    member = db.query(Member).filter(Member.id == target_member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 检查是否已存在该周的周报
    existing = db.query(WeeklyReport).filter(
        WeeklyReport.report_type == "personal",
        WeeklyReport.member_id == target_member_id,
        WeeklyReport.week_start == request.week_start,
        WeeklyReport.week_end == request.week_end,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该周的个人周报已存在"
        )
    
    # 收集数据
    data = _collect_personal_weekly_data(db, member, request.week_start, request.week_end)
    
    # 调用AI生成
    ai_result = ai_service.generate_personal_weekly_report(data)
    
    # 创建周报记录
    report = WeeklyReport(
        report_type="personal",
        member_id=target_member_id,
        week_start=request.week_start,
        week_end=request.week_end,
        summary=ai_result["summary"],
        achievements=ai_result["achievements"],
        issues=ai_result["issues"],
        next_week_plan=ai_result["next_week_plan"],
        raw_data=data.model_dump(mode="json"),
        ai_model=settings.DASHSCOPE_MODEL if ai_service.is_available() else "fallback",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # 加载关联
    report = db.query(WeeklyReport).options(
        joinedload(WeeklyReport.member)
    ).filter(WeeklyReport.id == report.id).first()
    
    return Response(data=convert_report_to_info(report))


# ==================== 生成项目周报 ====================

@router.post("/generate/project", response_model=Response[WeeklyReportInfo])
def generate_project_weekly_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    request: ProjectWeeklyReportRequest,
):
    """
    生成项目周报
    """
    # 检查项目是否存在
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 检查是否已存在该周的周报
    existing = db.query(WeeklyReport).filter(
        WeeklyReport.report_type == "project",
        WeeklyReport.project_id == request.project_id,
        WeeklyReport.week_start == request.week_start,
        WeeklyReport.week_end == request.week_end,
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="该周的项目周报已存在"
        )
    
    # 收集数据
    data = _collect_project_weekly_data(db, project, request.week_start, request.week_end)
    
    # 调用AI生成
    ai_result = ai_service.generate_project_weekly_report(data)
    
    # 创建周报记录
    report = WeeklyReport(
        report_type="project",
        project_id=request.project_id,
        week_start=request.week_start,
        week_end=request.week_end,
        summary=ai_result["summary"],
        achievements=ai_result["achievements"],
        issues=ai_result["issues"],
        next_week_plan=ai_result["next_week_plan"],
        raw_data=data.model_dump(mode="json"),
        ai_model=settings.DASHSCOPE_MODEL if ai_service.is_available() else "fallback",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # 加载关联
    report = db.query(WeeklyReport).options(
        joinedload(WeeklyReport.project)
    ).filter(WeeklyReport.id == report.id).first()
    
    return Response(data=convert_report_to_info(report))


# ==================== 编辑周报 ====================

@router.put("/{report_id}", response_model=Response[WeeklyReportInfo])
def update_weekly_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    report_id: int,
    report_in: WeeklyReportUpdate,
):
    """
    编辑周报（添加编辑后的内容）
    """
    report = db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly report not found"
        )
    
    # 权限检查：个人周报只能本人编辑，项目周报项目创建者可编辑
    if report.report_type == "personal":
        if report.member_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只能编辑自己的周报"
            )
    else:
        project = db.query(Project).filter(Project.id == report.project_id).first()
        if not check_owner_or_admin(current_user, project.created_by if project else None):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有项目创建者或管理员可以编辑项目周报"
            )
    
    # 更新编辑后的内容
    update_data = report_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(report, field, value)
    
    db.commit()
    db.refresh(report)
    
    report = db.query(WeeklyReport).options(
        joinedload(WeeklyReport.member),
        joinedload(WeeklyReport.project),
        joinedload(WeeklyReport.reviewer)
    ).filter(WeeklyReport.id == report.id).first()
    
    return Response(data=convert_report_to_info(report))


# ==================== 删除周报 ====================

@router.delete("/{report_id}", response_model=Response)
def delete_weekly_report(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    report_id: int,
):
    """
    删除周报
    """
    report = db.query(WeeklyReport).filter(WeeklyReport.id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Weekly report not found"
        )
    
    # 权限检查
    if report.report_type == "personal":
        if report.member_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只能删除自己的周报"
            )
    else:
        project = db.query(Project).filter(Project.id == report.project_id).first()
        if not check_owner_or_admin(current_user, project.created_by if project else None):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="只有项目创建者或管理员可以删除项目周报"
            )
    
    db.delete(report)
    db.commit()
    
    return Response(message="Weekly report deleted successfully")


# ==================== 辅助函数 ====================

def _collect_personal_weekly_data(
    db: Session, 
    member: Member, 
    week_start: date, 
    week_end: date
) -> PersonalWeeklyData:
    """收集个人周报所需数据"""
    
    # 工时记录
    work_logs = db.query(DailyWorkLog).options(
        joinedload(DailyWorkLog.task),
        joinedload(DailyWorkLog.project)
    ).filter(
        DailyWorkLog.member_id == member.id,
        DailyWorkLog.work_date >= week_start,
        DailyWorkLog.work_date <= week_end,
    ).order_by(DailyWorkLog.work_date).all()
    
    work_log_summaries = [
        WorkLogSummaryForReport(
            project_name=log.project.name if log.project else "Unknown",
            task_title=log.task.title if log.task else "Unknown",
            hours=float(log.hours),
            description=log.description,
            work_date=log.work_date,
        )
        for log in work_logs
    ]
    
    total_hours = sum(float(log.hours) for log in work_logs)
    
    # 涉及的任务
    task_ids = list(set(log.task_id for log in work_logs))
    tasks = db.query(Task).filter(Task.id.in_(task_ids)).all() if task_ids else []
    
    task_summaries = [
        TaskSummaryForReport(
            task_id=t.id,
            title=t.title,
            status=t.status,
            priority=t.priority,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else 0,
            status_changes=[],
        )
        for t in tasks
    ]
    
    completed_count = sum(1 for t in tasks if t.status == "done")
    in_progress_count = sum(1 for t in tasks if t.status == "in_progress")
    
    # 每日总结
    daily_summaries = db.query(DailySummary).filter(
        DailySummary.member_id == member.id,
        DailySummary.summary_date >= week_start,
        DailySummary.summary_date <= week_end,
    ).all()
    
    daily_summary_items = [
        DailySummaryForReport(
            summary_date=ds.summary_date,
            problems=ds.problems,
            tomorrow_plan=ds.tomorrow_plan,
        )
        for ds in daily_summaries
    ]
    
    return PersonalWeeklyData(
        member_name=member.name,
        week_start=week_start,
        week_end=week_end,
        total_hours=total_hours,
        work_logs=work_log_summaries,
        tasks_worked=task_summaries,
        daily_summaries=daily_summary_items,
        completed_tasks_count=completed_count,
        in_progress_tasks_count=in_progress_count,
    )


def _collect_project_weekly_data(
    db: Session, 
    project: Project, 
    week_start: date, 
    week_end: date
) -> ProjectWeeklyData:
    """收集项目周报所需数据"""
    
    # 项目工时
    work_logs = db.query(DailyWorkLog).filter(
        DailyWorkLog.project_id == project.id,
        DailyWorkLog.work_date >= week_start,
        DailyWorkLog.work_date <= week_end,
    ).all()
    
    total_hours = sum(float(log.hours) for log in work_logs)
    
    # 成员贡献统计
    member_stats = {}
    for log in work_logs:
        if log.member_id not in member_stats:
            member_stats[log.member_id] = {"hours": 0, "task_ids": set()}
        member_stats[log.member_id]["hours"] += float(log.hours)
        member_stats[log.member_id]["task_ids"].add(log.task_id)
    
    member_contributions = []
    for mid, stats in member_stats.items():
        member = db.query(Member).filter(Member.id == mid).first()
        member_contributions.append({
            "member_name": member.name if member else "Unknown",
            "hours": stats["hours"],
            "tasks_count": len(stats["task_ids"]),
        })
    
    # 本周完成的任务
    completed_tasks = db.query(Task).filter(
        Task.project_id == project.id,
        Task.status == "done",
        Task.completed_at >= week_start,
        Task.completed_at <= week_end,
    ).all()
    
    completed_summaries = [
        TaskSummaryForReport(
            task_id=t.id,
            title=t.title,
            status=t.status,
            priority=t.priority,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else 0,
            status_changes=[],
        )
        for t in completed_tasks
    ]
    
    # 进行中的任务
    in_progress_tasks = db.query(Task).filter(
        Task.project_id == project.id,
        Task.status.in_(["in_progress", "task_review", "result_review"]),
    ).all()
    
    in_progress_summaries = [
        TaskSummaryForReport(
            task_id=t.id,
            title=t.title,
            status=t.status,
            priority=t.priority,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else 0,
            status_changes=[],
        )
        for t in in_progress_tasks
    ]
    
    # 本周新增的任务
    new_tasks = db.query(Task).filter(
        Task.project_id == project.id,
        Task.created_at >= week_start,
        Task.created_at <= week_end,
    ).all()
    
    new_task_summaries = [
        TaskSummaryForReport(
            task_id=t.id,
            title=t.title,
            status=t.status,
            priority=t.priority,
            estimated_hours=float(t.estimated_hours) if t.estimated_hours else None,
            actual_hours=float(t.actual_hours) if t.actual_hours else 0,
            status_changes=[],
        )
        for t in new_tasks
    ]
    
    # 本周会议
    meetings = db.query(Meeting).filter(
        Meeting.project_id == project.id,
        Meeting.meeting_date >= week_start,
        Meeting.meeting_date <= week_end,
    ).all()
    
    meeting_summaries = [
        {
            "title": m.title,
            "date": str(m.meeting_date),
            "summary": m.summary,
        }
        for m in meetings
    ]
    
    return ProjectWeeklyData(
        project_name=project.name,
        week_start=week_start,
        week_end=week_end,
        total_hours=total_hours,
        member_contributions=member_contributions,
        tasks_completed=completed_summaries,
        tasks_in_progress=in_progress_summaries,
        new_tasks=new_task_summaries,
        meetings_held=meeting_summaries,
    )
