from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


class UserRegister(BaseModel):
    username: str = Field(..., min_length=2, max_length=20)
    password: str = Field(..., min_length=6)
    email: Optional[str] = None
    role: Literal['student', 'teacher'] = 'student'


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: Optional[str]
    avatar: Optional[str]
    role: str
    created_at: datetime
