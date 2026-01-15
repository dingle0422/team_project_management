"""
任务模型
"""
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import String, DateTime, Date, Text, ForeignKey, Integer, Numeric, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Task(Base):
    """任务表"""
    
    __tablename__ = "tasks"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, comment="所属项目ID")
    meeting_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True, comment="关联会议纪要ID")
    
    # 任务基本信息
    title: Mapped[str] = mapped_column(String(200), nullable=False, comment="任务标题")
    description: Mapped[str | None] = mapped_column(Text, nullable=True, comment="任务描述")
    
    # 负责人和干系人
    assignee_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="负责人ID")
    stakeholder_ids: Mapped[list | None] = mapped_column(ARRAY(Integer), nullable=True, comment="干系人ID数组")
    
    # 时间预估与实际
    estimated_hours: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True, comment="预估工时")
    actual_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0, comment="实际工时")
    
    # 状态与优先级 - 流程：todo → task_review → in_progress → result_review → done
    status: Mapped[str] = mapped_column(String(20), default="todo", comment="任务状态: todo, task_review, in_progress, result_review, done, cancelled")
    priority: Mapped[str] = mapped_column(String(10), default="medium", comment="优先级: low, medium, high, urgent")
    
    # 时间节点
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="开始日期")
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True, comment="截止日期")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="完成时间")
    
    # 父任务
    parent_task_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=True, comment="父任务ID")
    
    # 任务类型
    task_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="任务类型: feature, bugfix, research, documentation")
    
    # 排序
    sort_order: Mapped[int] = mapped_column(Integer, default=0, comment="排序")
    
    created_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="创建人ID")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    # 关系
    project = relationship("Project", back_populates="tasks")
    meeting = relationship("Meeting", back_populates="tasks")
    assignee = relationship("Member", back_populates="assigned_tasks", foreign_keys=[assignee_id])
    creator = relationship("Member", foreign_keys=[created_by])
    parent_task = relationship("Task", remote_side=[id], backref="sub_tasks")
    stakeholders = relationship("TaskStakeholder", back_populates="task", cascade="all, delete-orphan")
    status_history = relationship("TaskStatusHistory", back_populates="task", cascade="all, delete-orphan")
    work_logs = relationship("DailyWorkLog", back_populates="task")
    
    def __repr__(self):
        return f"<Task(id={self.id}, title={self.title}, status={self.status})>"


class TaskStakeholder(Base):
    """任务干系人关联表"""
    
    __tablename__ = "task_stakeholders"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="stakeholder", comment="角色: stakeholder, reviewer, collaborator")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    # 关系
    task = relationship("Task", back_populates="stakeholders")
    member = relationship("Member")
    
    def __repr__(self):
        return f"<TaskStakeholder(task_id={self.task_id}, member_id={self.member_id}, role={self.role})>"


class TaskStatusHistory(Base):
    """任务状态变更历史表"""
    
    __tablename__ = "task_status_history"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="原状态")
    to_status: Mapped[str] = mapped_column(String(20), nullable=False, comment="新状态")
    changed_by: Mapped[int | None] = mapped_column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, comment="操作人ID")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True, comment="变更说明")
    
    # 评审相关字段
    review_type: Mapped[str | None] = mapped_column(String(50), nullable=True, comment="评审类型: task_review, result_review")
    review_result: Mapped[str | None] = mapped_column(String(20), nullable=True, comment="评审结果: passed, rejected")
    review_feedback: Mapped[str | None] = mapped_column(Text, nullable=True, comment="评审意见")
    
    changed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="变更时间")
    
    # 关系
    task = relationship("Task", back_populates="status_history")
    changer = relationship("Member", foreign_keys=[changed_by])
    approvals = relationship("TaskStatusApproval", back_populates="status_change", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<TaskStatusHistory(task_id={self.task_id}, {self.from_status} -> {self.to_status})>"


class TaskStatusApproval(Base):
    """任务状态变更审批表 - 干系人投票"""
    
    __tablename__ = "task_status_approvals"
    
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    status_change_id: Mapped[int] = mapped_column(Integer, ForeignKey("task_status_history.id", ondelete="CASCADE"), nullable=False, comment="状态变更ID")
    stakeholder_id: Mapped[int] = mapped_column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, comment="干系人ID")
    
    # 审批结果: pending（待审批）, approved（通过）, rejected（拒绝）
    approval_status: Mapped[str] = mapped_column(String(20), default="pending", comment="审批状态")
    comment: Mapped[str | None] = mapped_column(Text, nullable=True, comment="审批意见")
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, comment="创建时间")
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, comment="审批时间")
    
    # 关系
    status_change = relationship("TaskStatusHistory", back_populates="approvals")
    stakeholder = relationship("Member", foreign_keys=[stakeholder_id])
    
    def __repr__(self):
        return f"<TaskStatusApproval(status_change_id={self.status_change_id}, stakeholder_id={self.stakeholder_id}, status={self.approval_status})>"
