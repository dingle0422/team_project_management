"""
应用配置模块
"""
from typing import Optional, List
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""
    
    # 应用基础配置
    APP_NAME: str = "算法团队项目管理系统"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # API配置
    API_V1_PREFIX: str = "/api/v1"
    
    # 数据库配置 (同步版本)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/project_management"
    DATABASE_ECHO: bool = False
    
    # JWT认证配置
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24小时
    
    # AI服务配置（阿里百炼）
    API_KEY: Optional[str] = "sk-fb07e345e2b04562ad5acf2d4bfee8fa"
    MODEL: str = "qwen3-max"
    BASE_URL: Optional[str] = None
    
    # CORS配置
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


settings = get_settings()
