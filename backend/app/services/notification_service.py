"""
通知服务 - @提及解析和通知创建
"""
import re
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.member import Member
from app.models.notification import Notification


class NotificationService:
    """通知服务类"""
    
    # @提及的正则表达式：匹配 @用户名 或 @{用户名}
    MENTION_PATTERN = re.compile(r'@\{([^}]+)\}|@(\S+?)(?=\s|$|[，。！？,\.!?])')
    
    def parse_mentions(self, text: str) -> List[str]:
        """
        解析文本中的@提及
        
        支持格式：
        - @张三
        - @{张三}（支持包含空格的名字）
        
        返回: 被提及的用户名列表
        """
        if not text:
            return []
        
        matches = self.MENTION_PATTERN.findall(text)
        # findall返回的是元组列表，需要提取非空值
        mentioned_names = []
        for match in matches:
            name = match[0] or match[1]  # 第一个是{xxx}格式，第二个是普通格式
            if name:
                mentioned_names.append(name.strip())
        
        return list(set(mentioned_names))  # 去重
    
    def get_mentioned_members(self, db: Session, text: str) -> List[Member]:
        """
        解析文本并返回被提及的成员对象
        """
        mentioned_names = self.parse_mentions(text)
        if not mentioned_names:
            return []
        
        # 查询匹配的成员
        members = db.query(Member).filter(
            Member.name.in_(mentioned_names),
            Member.status == "active"
        ).all()
        
        return members
    
    def create_mention_notifications(
        self,
        db: Session,
        text: str,
        sender_id: int,
        content_type: str,
        content_id: int,
        title: str,
        link: Optional[str] = None,
        exclude_ids: Optional[List[int]] = None,
    ) -> List[Notification]:
        """
        解析文本中的@提及并创建通知
        
        参数:
        - text: 包含@提及的文本
        - sender_id: 发送者ID
        - content_type: 内容类型 (task, meeting, daily_log等)
        - content_id: 内容ID
        - title: 通知标题
        - link: 跳转链接
        - exclude_ids: 排除的用户ID列表（如发送者自己）
        
        返回: 创建的通知列表
        """
        exclude_ids = exclude_ids or []
        exclude_ids.append(sender_id)  # 不通知自己
        
        mentioned_members = self.get_mentioned_members(db, text)
        notifications = []
        
        for member in mentioned_members:
            if member.id in exclude_ids:
                continue
            
            # 提取上下文（@前后的文字）
            context = self._extract_mention_context(text, member.name)
            
            notification = Notification(
                recipient_id=member.id,
                sender_id=sender_id,
                notification_type="mention",
                content_type=content_type,
                content_id=content_id,
                title=title,
                message=context,
                link=link,
            )
            db.add(notification)
            notifications.append(notification)
        
        return notifications
    
    def create_notification(
        self,
        db: Session,
        recipient_id: int,
        sender_id: Optional[int],
        notification_type: str,
        content_type: str,
        content_id: int,
        title: str,
        message: Optional[str] = None,
        link: Optional[str] = None,
    ) -> Notification:
        """
        创建单个通知
        """
        notification = Notification(
            recipient_id=recipient_id,
            sender_id=sender_id,
            notification_type=notification_type,
            content_type=content_type,
            content_id=content_id,
            title=title,
            message=message,
            link=link,
        )
        db.add(notification)
        return notification
    
    def create_assignment_notification(
        self,
        db: Session,
        assignee_id: int,
        sender_id: int,
        task_id: int,
        task_title: str,
    ) -> Notification:
        """
        创建任务分配通知
        """
        return self.create_notification(
            db=db,
            recipient_id=assignee_id,
            sender_id=sender_id,
            notification_type="assignment",
            content_type="task",
            content_id=task_id,
            title=f"您被分配了新任务",
            message=f"任务: {task_title}",
            link=f"/tasks/{task_id}",
        )
    
    def create_status_change_notification(
        self,
        db: Session,
        recipient_ids: List[int],
        sender_id: int,
        task_id: int,
        task_title: str,
        old_status: str,
        new_status: str,
    ) -> List[Notification]:
        """
        创建状态变更通知
        """
        status_names = {
            "todo": "待办",
            "task_review": "任务评审",
            "in_progress": "进行中",
            "result_review": "成果评审",
            "done": "已完成",
            "cancelled": "已取消",
        }
        
        notifications = []
        for recipient_id in recipient_ids:
            if recipient_id == sender_id:
                continue
            
            notification = self.create_notification(
                db=db,
                recipient_id=recipient_id,
                sender_id=sender_id,
                notification_type="status_change",
                content_type="task",
                content_id=task_id,
                title=f"任务状态已更新",
                message=f"任务「{task_title}」状态从{status_names.get(old_status, old_status)}变更为{status_names.get(new_status, new_status)}",
                link=f"/tasks/{task_id}",
            )
            notifications.append(notification)
        
        return notifications
    
    def create_review_notification(
        self,
        db: Session,
        reviewer_ids: List[int],
        sender_id: int,
        task_id: int,
        task_title: str,
        review_type: str,
    ) -> List[Notification]:
        """
        创建评审请求通知
        """
        review_type_names = {
            "task_review": "任务评审",
            "result_review": "成果评审",
        }
        
        notifications = []
        for reviewer_id in reviewer_ids:
            if reviewer_id == sender_id:
                continue
            
            notification = self.create_notification(
                db=db,
                recipient_id=reviewer_id,
                sender_id=sender_id,
                notification_type="review",
                content_type="task",
                content_id=task_id,
                title=f"请求{review_type_names.get(review_type, '评审')}",
                message=f"任务「{task_title}」等待您的评审",
                link=f"/tasks/{task_id}",
            )
            notifications.append(notification)
        
        return notifications
    
    def _extract_mention_context(self, text: str, name: str, context_length: int = 50) -> str:
        """
        提取@提及的上下文
        """
        # 查找@name的位置
        patterns = [f"@{{{name}}}", f"@{name}"]
        for pattern in patterns:
            pos = text.find(pattern)
            if pos != -1:
                start = max(0, pos - context_length)
                end = min(len(text), pos + len(pattern) + context_length)
                context = text[start:end]
                if start > 0:
                    context = "..." + context
                if end < len(text):
                    context = context + "..."
                return context
        
        return text[:100] if len(text) > 100 else text
    
    def create_stakeholder_notification(
        self,
        db: Session,
        stakeholder_ids: List[int],
        sender_id: int,
        task_id: int,
        task_title: str,
    ) -> List[Notification]:
        """
        创建干系人通知（任务创建时通知干系人）
        """
        notifications = []
        for stakeholder_id in stakeholder_ids:
            if stakeholder_id == sender_id:
                continue
            
            notification = self.create_notification(
                db=db,
                recipient_id=stakeholder_id,
                sender_id=sender_id,
                notification_type="stakeholder",
                content_type="task",
                content_id=task_id,
                title="您被添加为任务干系人",
                message=f"任务「{task_title}」需要您关注",
                link=f"/tasks/{task_id}",
            )
            notifications.append(notification)
        
        return notifications
    
    def create_approval_request_notification(
        self,
        db: Session,
        stakeholder_ids: List[int],
        sender_id: int,
        task_id: int,
        task_title: str,
        from_status: str,
        to_status: str,
    ) -> List[Notification]:
        """
        创建状态变更审批请求通知
        """
        status_names = {
            "todo": "待办",
            "task_review": "任务评审",
            "in_progress": "进行中",
            "result_review": "成果评审",
            "done": "已完成",
            "cancelled": "已取消",
        }
        
        notifications = []
        for stakeholder_id in stakeholder_ids:
            if stakeholder_id == sender_id:
                continue
            
            notification = self.create_notification(
                db=db,
                recipient_id=stakeholder_id,
                sender_id=sender_id,
                notification_type="approval_request",
                content_type="task",
                content_id=task_id,
                title="需要您审批状态变更",
                message=f"任务「{task_title}」状态将从{status_names.get(from_status, from_status)}变更为{status_names.get(to_status, to_status)}，请审批",
                link=f"/tasks?task={task_id}",
            )
            notifications.append(notification)
        
        return notifications


# 全局通知服务实例
notification_service = NotificationService()
