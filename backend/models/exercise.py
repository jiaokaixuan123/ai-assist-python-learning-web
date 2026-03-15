from pydantic import BaseModel, Field
from typing import Optional, List


class TestCase(BaseModel):
    input: Optional[str] = ""
    expected_output: str


class ExerciseBase(BaseModel):
    title: str
    description: str       # Markdown 题目描述
    difficulty: str        # easy / medium / hard
    tags: List[str] = []
    starter_code: Optional[str] = ""
    hint: Optional[str] = None


class ExerciseOut(ExerciseBase):
    id: str
    test_cases: List[TestCase] = []


class SubmissionIn(BaseModel):
    exercise_id: str
    code: str
    passed: bool
    result: str            # 判题结果描述
