from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class Lesson(BaseModel):
    id: str
    title: str
    content: str          # Markdown 内容
    starter_code: Optional[str] = ""
    order: int


class CourseBase(BaseModel):
    title: str
    description: str
    difficulty: str       # beginner / intermediate / advanced
    tags: List[str] = []
    cover: Optional[str] = None


class CourseOut(CourseBase):
    id: str
    lessons: List[Lesson] = []
    lesson_count: int
    created_at: datetime
