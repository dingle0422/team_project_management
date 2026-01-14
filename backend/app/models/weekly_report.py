"""
周报模型
"""
from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, Text, ForeignKey, Integer, Boolean, JSON, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class WeeklyReport(Base):
    """AI生成周报表"""
    
    __tablename__ = "weekly_reports"
    __table_args__ = (
        CheckConstraint(
            "(report_type = 'personal' AND member_id IS NOT NULL) OR (report_type = 'project' AND project_id IS NOT NULL)",
            name='chk_report_type_match'
        ),
    )
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 周报类型：personal（个人）或 project（项目）
    report_type: Mapped[str] = mapped_column(String(20), nullable=False, comment="周报类型: personal, project")
    
    # 根据类型，二选一
    member_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=True, comment="成员ID（个人周报）")
    project_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True, comment="项目ID（项目周报）")
    
    # 周报时间范围
    week_start: Mapped[date] = mapped_column(Date, nullable=False, comment="周开始日期")
    week_end: Mapped[date] = mapped_column(Date, nullable=False, comment="周结束日期")
    
    # AI生成的内容
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="本周总结")
    achievements: Mapped[str | None] = mapped_column(Text, nullable=True, comment="主要成果")
    issues: Mapped[str | None] = mapped_column(Text, nullable=True, comment="问题与风险")
    next_week_plan: Mapped[str | None] = mapped_column(Text, nullable=True, comment="下周计划")
    
    # 原始数据快照
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True, comment="原始数据快照")
    
    # AI模型信息
    ai_model: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="AI模型")
    
    # 编辑后的内容
    edited_summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="编辑后的总结")
    edited_achievements: Mapped[str | None] = mapped_column(Text, nullable=True, comment="编辑后的成果")
    edited_issues: Mapped[str | None] = mapped_column(Text, nullable=True, comment="编辑后的问题")
    edited_next_week_plan: Mapped[str | None] = mapped_column(Text, nullable=True, comment="编辑后的计划")
    
    # 审核状态
    is_reviewed: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已审核")
    reviewed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="审核人ID")
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="审核时间")
    
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="生成时间")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    member = relationship("Member", foreign_keys=[member_id])
    project = relationship("Project")
    reviewer = relationship("Member", foreign_keys=[reviewed_by])
    
    def __repr__(self):
        return f"<WeeklyReport(id={self.id}, type={self.report_type}, week={self.week_start}~{self.week_end})>"
