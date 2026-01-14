"""
日报模型
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Text, ForeignKey, Integer, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class DailyWorkLog(Base):
    """每日工作记录表"""
    
    __tablename__ = "daily_work_logs"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, comment="成员ID")
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, comment="任务ID")
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, comment="项目ID")
    
    work_date: Mapped[date] = mapped_column(Date, nullable=False, comment="工作日期")
    hours: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, comment="工时")
    description: Mapped[str] = mapped_column(Text, nullable=False, comment="工作内容描述")
    work_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="工作类型: development, debugging, meeting, documentation, research, review, other")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    member = relationship("Member", back_populates="daily_work_logs")
    task = relationship("Task", back_populates="work_logs")
    project = relationship("Project")
    
    def __repr__(self):
        return f"<DailyWorkLog(id={self.id}, member_id={self.member_id}, date={self.work_date}, hours={self.hours})>"


class DailySummary(Base):
    """每日总结表"""
    
    __tablename__ = "daily_summaries"
    __table_args__ = (
        UniqueConstraint('member_id', 'summary_date', name='uq_daily_summary_member_date'),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, comment="成员ID")
    summary_date: Mapped[date] = mapped_column(Date, nullable=False, comment="总结日期")
    problems: Mapped[str | None] = mapped_column(Text, nullable=True, comment="今日遇到的问题")
    tomorrow_plan: Mapped[str | None] = mapped_column(Text, nullable=True, comment="明日计划")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True, comment="其他备注")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    member = relationship("Member", back_populates="daily_summaries")
    
    def __repr__(self):
        return f"<DailySummary(id={self.id}, member_id={self.member_id}, date={self.summary_date})>"
