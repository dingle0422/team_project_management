"""
数据库连接模块
"""
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from app.core.config import settings


# 创建数据库引擎
engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DATABASE_ECHO,
    pool_pre_ping=True,
)

# 创建会话工厂
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# 声明基类
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    获取数据库会话的依赖注入函数
    用于FastAPI的Depends
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """初始化数据库（创建所有表）"""
    # 导入所有模型以确保它们注册到Base.metadata
    from app import models  # noqa: F401
    Base.metadata.create_all(bind=engine)


def close_db():
    """关闭数据库连接"""
    engine.dispose()
