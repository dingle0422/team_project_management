"""
通用Schema定义
"""
from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar("T")


class ResponseBase(BaseModel):
    """通用响应基类"""
    code: int = 200
    message: str = "success"


class Response(ResponseBase, Generic[T]):
    """通用响应模型"""
    data: Optional[T] = None


class PaginationParams(BaseModel):
    """分页参数"""
    page: int = 1
    page_size: int = 20


class PaginatedData(BaseModel, Generic[T]):
    """分页数据"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedResponse(ResponseBase, Generic[T]):
    """分页响应"""
    data: PaginatedData[T]
