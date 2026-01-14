"""
会议纪要模型
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Meeting(Base):
    """会议纪要表"""
    
    __tablename__ = "meetings"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, comment="所属项目ID")
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="会议标题")
    meeting_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, comment="会议时间")
    location: Mapped[str | None] = mapped_column(String(100), nullable=True, comment="会议地点/链接")
    meeting_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="会议类型")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True, comment="会议摘要")
    content: Mapped[str | None] = mapped_column(Text, nullable=True, comment="会议详细内容")
    attendee_ids: Mapped[list | None] = mapped_column(ARRAY(Integer), nullable=True, comment="参会人员ID数组")
    
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="创建人ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    project = relationship("Project", back_populates="meetings")
    creator = relationship("Member", foreign_keys=[created_by])
    tasks = relationship("Task", back_populates="meeting")
    
    def __repr__(self):
        return f"<Meeting(id={self.id}, title={self.title})>"
