"""
项目模型
"""
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Project(Base):
    """项目表"""
    
    __tablename__ = "projects"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False, comment="项目名称")
    code: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, comment="项目编号")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="项目描述")
    status: Mapped[str] = mapped_column(String(20), default="active", comment="项目状态: active, completed, suspended, archived")
    priority: Mapped[str] = mapped_column(String(10), default="medium", comment="优先级: low, medium, high")
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="开始日期")
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="截止日期")
    owner_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="项目负责人ID")
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="创建者ID")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    owner = relationship("Member", back_populates="owned_projects", foreign_keys=[owner_id])
    creator = relationship("Member", foreign_keys=[created_by])
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    meetings = relationship("Meeting", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name={self.name}, code={self.code})>"


class ProjectMember(Base):
    """项目成员关联表"""
    
    __tablename__ = "project_members"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="developer", comment="在项目中的角色")
    
    joined_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="加入时间")
    
    # 关系
    project = relationship("Project", back_populates="members")
    member = relationship("Member")
    
    def __repr__(self):
        return f"<ProjectMember(project_id={self.project_id}, member_id={self.member_id})>"
