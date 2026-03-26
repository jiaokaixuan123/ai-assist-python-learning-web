from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class BookBase(BaseModel):
    title: str
    author: Optional[str] = ""
    description: Optional[str] = ""
    difficulty: str = "beginner"   # beginner / intermediate / advanced
    tags: List[str] = []
    cover: Optional[str] = None


class BookOut(BookBase):
    id: str
    file_path: Optional[str] = None  # 相对路径，用于下载/预览
    file_name: Optional[str] = None
    indexed: bool = False            # 是否已向量化入知识库
    created_at: datetime
