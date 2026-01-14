"""
数据库初始化脚本
用于创建数据库表和初始数据
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import engine, Base, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models import Member


async def create_tables():
    """创建所有数据库表"""
    print("📦 开始创建数据库表...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ 数据库表创建完成")


async def create_admin_user():
    """创建管理员账号"""
    print("👤 检查管理员账号...")
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        
        # 检查是否已存在管理员
        result = await session.execute(
            select(Member).where(Member.email == "admin@example.com")
        )
        admin = result.scalar_one_or_none()
        
        if admin:
            print("✅ 管理员账号已存在")
            return
        
        # 创建管理员账号
        admin = Member(
            name="系统管理员",
            email="admin@example.com",
            password_hash=get_password_hash("admin123"),
            role="admin",
            job_title="系统管理员",
            status="active"
        )
        session.add(admin)
        await session.commit()
        print("✅ 管理员账号创建成功")
        print("   邮箱: admin@example.com")
        print("   密码: admin123")


async def create_demo_data():
    """创建演示数据"""
    print("📝 创建演示数据...")
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from app.models import Project, Member
        from datetime import date, timedelta
        
        # 检查是否已有数据
        result = await session.execute(select(Project))
        if result.scalars().first():
            print("✅ 演示数据已存在")
            return
        
        # 获取管理员
        result = await session.execute(
            select(Member).where(Member.email == "admin@example.com")
        )
        admin = result.scalar_one_or_none()
        
        if not admin:
            print("⚠️ 未找到管理员账号，跳过演示数据创建")
            return
        
        # 创建演示成员
        members_data = [
            {"name": "张三", "email": "zhangsan@example.com", "job_title": "算法工程师"},
            {"name": "李四", "email": "lisi@example.com", "job_title": "高级算法工程师"},
            {"name": "王五", "email": "wangwu@example.com", "job_title": "后端开发"},
            {"name": "赵六", "email": "zhaoliu@example.com", "job_title": "测试工程师"},
        ]
        
        for data in members_data:
            member = Member(
                name=data["name"],
                email=data["email"],
                password_hash=get_password_hash("123456"),
                role="member",
                job_title=data["job_title"],
                status="active"
            )
            session.add(member)
        
        # 创建演示项目
        project = Project(
            name="智能推荐系统",
            code="AI-2026-001",
            description="基于深度学习的个性化推荐系统，支持多场景推荐能力",
            status="active",
            priority="high",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=180),
            owner_id=admin.id
        )
        session.add(project)
        
        await session.commit()
        print("✅ 演示数据创建成功")


async def main():
    """主函数"""
    print("=" * 50)
    print("算法团队项目管理系统 - 数据库初始化")
    print("=" * 50)
    
    await create_tables()
    await create_admin_user()
    await create_demo_data()
    
    print("=" * 50)
    print("🎉 数据库初始化完成！")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
