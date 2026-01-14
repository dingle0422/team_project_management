"""
通知模型 - @提及通知
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Text, ForeignKey, Integer, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Notification(Base):
    """通知表"""
    
    __tablename__ = "notifications"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    # 接收者
    recipient_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, comment="接收者ID")
    
    # 发送者
    sender_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="发送者ID")
    
    # 通知类型
    notification_type: Mapped[str] = mapped_column(String(50), default="mention", comment="通知类型: mention, assignment, status_change, review")
    
    # 关联内容
    content_type: Mapped[str] = mapped_column(String(50), nullable=False, comment="内容类型: task, meeting, daily_log, project, comment")
    content_id: Mapped[int] = mapped_column(Integer, nullable=False, comment="内容ID")
    
    # 通知内容
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="通知标题")
    message: Mapped[str | None] = mapped_column(Text, nullable=True, comment="通知消息/上下文")
    
    # 跳转链接（前端路由）
    link: Mapped[str | None] = mapped_column(String(500), nullable=True, comment="跳转链接")
    
    # 状态
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已读")
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="阅读时间")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    # 关系
    recipient = relationship("Member", foreign_keys=[recipient_id])
    sender = relationship("Member", foreign_keys=[sender_id])
    
    def __repr__(self):
        return f"<Notification(id={self.id}, recipient_id={self.recipient_id}, type={self.notification_type})>"
