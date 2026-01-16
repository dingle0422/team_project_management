"""
邀请码模型
"""
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class InvitationCode(Base):
    """邀请码表"""
    
    __tablename__ = "invitation_codes"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, comment="邀请码")
    created_by_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id"), nullable=False, comment="创建者ID")
    used_by_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id"), nullable=True, comment="使用者ID")
    is_used: Mapped[bool] = mapped_column(Boolean, default=False, comment="是否已使用")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="过期时间")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="使用时间")
    
    # 关系
    created_by = relationship("Member", foreign_keys=[created_by_id], backref="created_invitation_codes")
    used_by = relationship("Member", foreign_keys=[used_by_id], backref="used_invitation_code")
    
    def __repr__(self):
        return f"<InvitationCode(id={self.id}, code={self.code}, is_used={self.is_used})>"
