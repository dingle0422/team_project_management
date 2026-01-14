"""
成员模型
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Member(Base):
    """团队成员表"""
    
    __tablename__ = "members"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment="姓名")
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, comment="邮箱")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False, comment="密码哈希")
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True, comment="头像URL")
    role: Mapped[str] = mapped_column(String(50), default="member", comment="系统角色: admin, manager, member")
    job_title: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="职位名称")
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="手机号")
    status: Mapped[str] = mapped_column(String(20), default="active", comment="账号状态: active, inactive")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    assigned_tasks = relationship("Task", back_populates="assignee", foreign_keys="Task.assignee_id")
    daily_work_logs = relationship("DailyWorkLog", back_populates="member")
    daily_summaries = relationship("DailySummary", back_populates="member")
    
    def __repr__(self):
        return f"<Member(id={self.id}, name={self.name}, email={self.email})>"
