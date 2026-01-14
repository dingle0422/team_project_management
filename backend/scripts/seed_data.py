#!/usr/bin/env python
"""
初始化种子数据脚本
"""
import sys
import os
from datetime import date, datetime, timedelta
from decimal import Decimal

# 添加项目根目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.member import Member
from app.models.project import Project, ProjectMember
from app.models.meeting import Meeting
from app.models.task import Task, TaskStakeholder


def seed_data():
    """创建初始测试数据"""
    print("🌱 开始创建种子数据...")
    
    # 初始化数据库
    init_db()
    
    db = SessionLocal()
    
    try:
        # 检查是否已有数据
        if db.query(Member).first():
            print("⚠️ 数据库已有数据，跳过种子数据创建")
            return
        
        # ==================== 创建成员 ====================
        print("👥 创建成员...")
        
        admin = Member(
            name="管理员",
            email="admin@example.com",
            password_hash=get_password_hash("admin123"),
            role="admin",
            job_title="系统管理员",
            status="active",
        )
        db.add(admin)
        
        members = []
        member_data = [
            ("张三", "zhangsan@example.com", "算法工程师"),
            ("李四", "lisi@example.com", "高级算法工程师"),
            ("王五", "wangwu@example.com", "算法工程师"),
            ("赵六", "zhaoliu@example.com", "算法实习生"),
        ]
        
        for name, email, job_title in member_data:
            member = Member(
                name=name,
                email=email,
                password_hash=get_password_hash("123456"),
                role="member",
                job_title=job_title,
                status="active",
            )
            db.add(member)
            members.append(member)
        
        db.flush()
        print(f"  ✅ 创建了 {len(members) + 1} 个成员")
        
        # ==================== 创建项目 ====================
        print("📁 创建项目...")
        
        project1 = Project(
            name="智能推荐系统",
            code="REC-001",
            description="基于深度学习的个性化推荐系统开发",
            status="active",
            priority="high",
            start_date=date.today() - timedelta(days=30),
            end_date=date.today() + timedelta(days=60),
            owner_id=members[0].id,
            created_by=members[0].id,
        )
        db.add(project1)
        
        project2 = Project(
            name="NLP文本分析平台",
            code="NLP-001",
            description="企业级自然语言处理平台",
            status="active",
            priority="medium",
            start_date=date.today() - timedelta(days=15),
            end_date=date.today() + timedelta(days=90),
            owner_id=members[1].id,
            created_by=members[1].id,
        )
        db.add(project2)
        
        db.flush()
        print("  ✅ 创建了 2 个项目")
        
        # 添加项目成员
        for i, member in enumerate(members):
            if i < 3:  # 前3个成员加入项目1
                pm = ProjectMember(
                    project_id=project1.id,
                    member_id=member.id,
                    role="developer" if i > 0 else "lead",
                )
                db.add(pm)
            if i > 0:  # 后3个成员加入项目2
                pm = ProjectMember(
                    project_id=project2.id,
                    member_id=member.id,
                    role="developer" if i > 1 else "lead",
                )
                db.add(pm)
        
        # ==================== 创建会议纪要 ====================
        print("📝 创建会议纪要...")
        
        meeting1 = Meeting(
            project_id=project1.id,
            title="推荐系统需求评审会",
            meeting_date=datetime.now() - timedelta(days=7),
            location="会议室A",
            summary="讨论了推荐系统的核心需求和技术方案",
            content="1. 确定使用协同过滤+深度学习混合方案\n2. 数据需求：用户行为日志、商品特征\n3. 目标：CTR提升15%",
            attendee_ids=[m.id for m in members[:3]],
            created_by=members[0].id,
        )
        db.add(meeting1)
        
        meeting2 = Meeting(
            project_id=project1.id,
            title="推荐系统技术方案评审",
            meeting_date=datetime.now() - timedelta(days=3),
            location="线上会议",
            summary="评审了模型架构和训练方案",
            content="1. 模型采用双塔结构\n2. 训练数据需要3个月历史数据\n3. 预计训练时间2天",
            attendee_ids=[m.id for m in members[:3]],
            created_by=members[1].id,
        )
        db.add(meeting2)
        
        db.flush()
        print("  ✅ 创建了 2 个会议纪要")
        
        # ==================== 创建任务 ====================
        print("✅ 创建任务...")
        
        tasks_data = [
            # 项目1的任务
            (project1.id, meeting1.id, "数据采集模块开发", "开发用户行为数据采集接口", members[0].id, "done", 16, 14),
            (project1.id, meeting1.id, "特征工程设计", "设计用户和商品特征体系", members[1].id, "in_progress", 24, 12),
            (project1.id, meeting2.id, "模型训练框架搭建", "搭建分布式训练框架", members[0].id, "task_review", 32, 0),
            (project1.id, meeting2.id, "模型效果评估", "设计A/B测试方案", members[2].id, "todo", 8, 0),
            # 项目2的任务
            (project2.id, None, "分词模块优化", "优化中文分词性能", members[1].id, "in_progress", 16, 8),
            (project2.id, None, "实体识别模型", "训练NER模型", members[2].id, "todo", 40, 0),
        ]
        
        for proj_id, meet_id, title, desc, assignee_id, status, est_hours, act_hours in tasks_data:
            task = Task(
                project_id=proj_id,
                meeting_id=meet_id,
                title=title,
                description=desc,
                assignee_id=assignee_id,
                status=status,
                priority="high" if "模型" in title else "medium",
                estimated_hours=Decimal(str(est_hours)),
                actual_hours=Decimal(str(act_hours)),
                start_date=date.today() - timedelta(days=7),
                due_date=date.today() + timedelta(days=14),
                created_by=assignee_id,
                completed_at=datetime.now() if status == "done" else None,
            )
            db.add(task)
        
        db.flush()
        print(f"  ✅ 创建了 {len(tasks_data)} 个任务")
        
        db.commit()
        print("\n🎉 种子数据创建完成！")
        print("\n📋 测试账号:")
        print("  管理员: admin@example.com / admin123")
        print("  普通用户: zhangsan@example.com / 123456")
        
    except Exception as e:
        db.rollback()
        print(f"❌ 创建种子数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
