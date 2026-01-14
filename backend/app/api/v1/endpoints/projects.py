"""
项目管理API
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func

from app.api.deps import get_db, get_current_user, check_owner_or_admin
from app.models.member import Member, ProjectMember
from app.models.project import Project
from app.models.task import Task
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectMemberAdd,
    ProjectMemberInfo,
    ProjectInfo,
    ProjectDetail,
    ProjectBrief,
    TaskStats,
)
from app.schemas.member import MemberBrief
from app.schemas.common import Response, PaginatedResponse, PaginatedData

router = APIRouter()


def get_project_task_stats(db: Session, project_id: int) -> TaskStats:
    """获取项目任务统计"""
    total = db.query(func.count(Task.id)).filter(Task.project_id == project_id).scalar()
    completed = db.query(func.count(Task.id)).filter(
        Task.project_id == project_id,
        Task.status == "completed"
    ).scalar()
    in_progress = db.query(func.count(Task.id)).filter(
        Task.project_id == project_id,
        Task.status == "in_progress"
    ).scalar()
    
    return TaskStats(total=total or 0, completed=completed or 0, in_progress=in_progress or 0)


def convert_project_to_info(db: Session, project: Project) -> ProjectInfo:
    """将Project转换为ProjectInfo"""
    member_count = db.query(func.count(ProjectMember.id)).filter(
        ProjectMember.project_id == project.id
    ).scalar() or 0
    
    owner_brief = None
    if project.owner:
        owner_brief = MemberBrief(
            id=project.owner.id,
            name=project.owner.name,
            avatar_url=project.owner.avatar_url,
        )
    
    task_stats = get_project_task_stats(db, project.id)
    
    return ProjectInfo(
        id=project.id,
        name=project.name,
        code=project.code,
        description=project.description,
        priority=project.priority,
        start_date=project.start_date,
        end_date=project.end_date,
        status=project.status,
        owner=owner_brief,
        member_count=member_count,
        task_stats=task_stats,
        created_at=project.created_at,
    )


@router.get("", response_model=PaginatedResponse[ProjectInfo])
def list_projects(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = Query(None, description="搜索关键字"),
    status: Optional[str] = Query(None, description="状态筛选"),
    my_projects: bool = Query(False, description="仅我创建的项目"),
):
    """
    获取项目列表（所有人可查看）
    """
    query = db.query(Project).options(joinedload(Project.owner))
    
    # 关键字搜索
    if keyword:
        query = query.filter(
            or_(
                Project.name.ilike(f"%{keyword}%"),
                Project.code.ilike(f"%{keyword}%"),
            )
        )
    
    # 状态筛选
    if status:
        query = query.filter(Project.status == status)
    
    # 我创建的项目
    if my_projects:
        query = query.filter(Project.created_by == current_user.id)
    
    total = query.count()
    offset = (page - 1) * page_size
    projects = query.order_by(Project.created_at.desc()).offset(offset).limit(page_size).all()
    
    total_pages = (total + page_size - 1) // page_size
    
    return PaginatedResponse(
        data=PaginatedData(
            items=[convert_project_to_info(db, p) for p in projects],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )
    )


@router.get("/all", response_model=Response[list[ProjectBrief]])
def list_all_projects(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    active_only: bool = Query(True, description="仅进行中项目"),
):
    """
    获取所有项目简要信息（用于下拉选择）
    """
    query = db.query(Project)
    if active_only:
        query = query.filter(Project.status.in_(["planning", "in_progress", "active"]))
    
    projects = query.order_by(Project.name).all()
    
    return Response(data=[ProjectBrief.model_validate(p) for p in projects])


@router.get("/{project_id}", response_model=Response[ProjectDetail])
def get_project(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
):
    """
    获取项目详情（所有人可查看）
    """
    project = db.query(Project).options(joinedload(Project.owner)).filter(
        Project.id == project_id
    ).first()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 获取项目成员
    project_members = db.query(ProjectMember, Member).join(
        Member, ProjectMember.member_id == Member.id
    ).filter(ProjectMember.project_id == project_id).all()
    
    members = [
        ProjectMemberInfo(
            id=member.id,
            name=member.name,
            role=pm.role,
            avatar_url=member.avatar_url,
            joined_at=pm.joined_at,
        )
        for pm, member in project_members
    ]
    
    # 计算进度
    task_stats = get_project_task_stats(db, project_id)
    progress = {
        "total_tasks": task_stats.total,
        "completed_tasks": task_stats.completed,
        "completion_rate": round(task_stats.completed / task_stats.total * 100, 1) if task_stats.total > 0 else 0,
    }
    
    owner_brief = None
    if project.owner:
        owner_brief = MemberBrief(
            id=project.owner.id,
            name=project.owner.name,
            avatar_url=project.owner.avatar_url,
        )
    
    return Response(
        data=ProjectDetail(
            id=project.id,
            name=project.name,
            code=project.code,
            description=project.description,
            priority=project.priority,
            start_date=project.start_date,
            end_date=project.end_date,
            status=project.status,
            owner=owner_brief,
            member_count=len(members),
            task_stats=task_stats,
            created_at=project.created_at,
            members=members,
            progress=progress,
        )
    )


@router.post("", response_model=Response[ProjectInfo])
def create_project(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_in: ProjectCreate,
):
    """
    创建项目（所有人可创建）
    """
    # 检查项目编号是否已存在
    if project_in.code:
        existing = db.query(Project).filter(Project.code == project_in.code).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project code already exists"
            )
    
    # 创建项目
    project = Project(
        name=project_in.name,
        code=project_in.code,
        description=project_in.description,
        priority=project_in.priority,
        start_date=project_in.start_date,
        end_date=project_in.end_date,
        owner_id=project_in.owner_id or current_user.id,
        created_by=current_user.id,  # 记录创建者
        status="planning",
    )
    db.add(project)
    db.flush()  # 获取project.id
    
    # 添加项目成员
    if project_in.member_ids:
        for member_id in project_in.member_ids:
            pm = ProjectMember(
                project_id=project.id,
                member_id=member_id,
                role="developer",
            )
            db.add(pm)
    
    db.commit()
    db.refresh(project)
    
    return Response(data=convert_project_to_info(db, project))


@router.put("/{project_id}", response_model=Response[ProjectInfo])
def update_project(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
    project_in: ProjectUpdate,
):
    """
    更新项目（仅创建者或管理员）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 权限检查：仅创建者或管理员可以更新
    if not check_owner_or_admin(current_user, project.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以修改此项目"
        )
    
    # 检查项目编号唯一性
    if project_in.code and project_in.code != project.code:
        existing = db.query(Project).filter(
            Project.code == project_in.code,
            Project.id != project_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project code already exists"
            )
    
    # 更新字段
    update_data = project_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)
    
    db.commit()
    db.refresh(project)
    
    return Response(data=convert_project_to_info(db, project))


@router.delete("/{project_id}", response_model=Response)
def delete_project(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
):
    """
    删除项目（仅创建者或管理员）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 权限检查：仅创建者或管理员可以删除
    if not check_owner_or_admin(current_user, project.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以删除此项目"
        )
    
    db.delete(project)
    db.commit()
    
    return Response(message="Project deleted successfully")


# ==================== 项目成员管理 ====================

@router.get("/{project_id}/members", response_model=Response[list[ProjectMemberInfo]])
def list_project_members(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
):
    """
    获取项目成员列表（所有人可查看）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    project_members = db.query(ProjectMember, Member).join(
        Member, ProjectMember.member_id == Member.id
    ).filter(ProjectMember.project_id == project_id).all()
    
    members = [
        ProjectMemberInfo(
            id=member.id,
            name=member.name,
            role=pm.role,
            avatar_url=member.avatar_url,
            joined_at=pm.joined_at,
        )
        for pm, member in project_members
    ]
    
    return Response(data=members)


@router.post("/{project_id}/members", response_model=Response[ProjectMemberInfo])
def add_project_member(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
    member_in: ProjectMemberAdd,
):
    """
    添加项目成员（仅创建者或管理员）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 权限检查：仅创建者或管理员可以添加成员
    if not check_owner_or_admin(current_user, project.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以添加项目成员"
        )
    
    # 检查成员是否存在
    member = db.query(Member).filter(Member.id == member_in.member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    
    # 检查是否已在项目中
    existing = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.member_id == member_in.member_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Member already in project"
        )
    
    pm = ProjectMember(
        project_id=project_id,
        member_id=member_in.member_id,
        role=member_in.role,
    )
    db.add(pm)
    db.commit()
    db.refresh(pm)
    
    return Response(
        data=ProjectMemberInfo(
            id=member.id,
            name=member.name,
            role=pm.role,
            avatar_url=member.avatar_url,
            joined_at=pm.joined_at,
        )
    )


@router.delete("/{project_id}/members/{member_id}", response_model=Response)
def remove_project_member(
    *,
    db: Session = Depends(get_db),
    current_user: Member = Depends(get_current_user),
    project_id: int,
    member_id: int,
):
    """
    移除项目成员（仅创建者或管理员）
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # 权限检查：仅创建者或管理员可以移除成员
    if not check_owner_or_admin(current_user, project.created_by):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有创建者或管理员可以移除项目成员"
        )
    
    pm = db.query(ProjectMember).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.member_id == member_id
    ).first()
    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not in project"
        )
    
    db.delete(pm)
    db.commit()
    
    return Response(message="Member removed from project")
