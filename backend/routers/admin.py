from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from pydantic import BaseModel
from typing import List
from core.database import get_db
from core.auth import require_teacher
from models.course import CourseBase, Lesson
from models.exercise import ExerciseBase, TestCase

router = APIRouter(prefix="/api/admin", tags=["admin"])


class CreateExerciseRequest(BaseModel):
    exercise: ExerciseBase
    test_cases: List[TestCase]


@router.post("/courses")
async def create_course(course: CourseBase, current_user: dict = Depends(require_teacher)):
    """创建新课程"""
    db = get_db()
    doc = {
        **course.dict(),
        "lessons": [],
        "lesson_count": 0,
        "created_at": datetime.utcnow(),
    }
    result = await db.courses.insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.post("/courses/{course_id}/lessons")
async def add_lesson(course_id: str, lesson: Lesson, current_user: dict = Depends(require_teacher)):
    """为课程添加章节"""
    db = get_db()
    try:
        result = await db.courses.update_one(
            {"_id": ObjectId(course_id)},
            {
                "$push": {"lessons": lesson.dict()},
                "$inc": {"lesson_count": 1}
            }
        )
        if result.matched_count == 0:
            raise HTTPException(404, "课程不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"添加失败: {str(e)}")


@router.post("/exercises")
async def create_exercise(req: CreateExerciseRequest, current_user: dict = Depends(require_teacher)):
    """创建新练习题"""
    db = get_db()
    doc = {
        **req.exercise.dict(),
        "test_cases": [tc.dict() for tc in req.test_cases],
    }
    result = await db.exercises.insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.put("/courses/{course_id}")
async def update_course(course_id: str, course: CourseBase, current_user: dict = Depends(require_teacher)):
    """更新课程基本信息"""
    db = get_db()
    try:
        result = await db.courses.update_one(
            {"_id": ObjectId(course_id)},
            {"$set": course.dict()}
        )
        if result.matched_count == 0:
            raise HTTPException(404, "课程不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"更新失败: {str(e)}")


@router.delete("/courses/{course_id}")
async def delete_course(course_id: str, current_user: dict = Depends(require_teacher)):
    """删除课程"""
    db = get_db()
    try:
        result = await db.courses.delete_one({"_id": ObjectId(course_id)})
        if result.deleted_count == 0:
            raise HTTPException(404, "课程不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"删除失败: {str(e)}")


@router.put("/courses/{course_id}/lessons/{lesson_id}")
async def update_lesson(course_id: str, lesson_id: str, lesson: Lesson, current_user: dict = Depends(require_teacher)):
    """更新章节内容"""
    db = get_db()
    try:
        result = await db.courses.update_one(
            {"_id": ObjectId(course_id), "lessons.id": lesson_id},
            {"$set": {"lessons.$": lesson.dict()}}
        )
        if result.matched_count == 0:
            raise HTTPException(404, "课程或章节不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"更新失败: {str(e)}")


@router.delete("/courses/{course_id}/lessons/{lesson_id}")
async def delete_lesson(course_id: str, lesson_id: str, current_user: dict = Depends(require_teacher)):
    """删除章节"""
    db = get_db()
    try:
        result = await db.courses.update_one(
            {"_id": ObjectId(course_id)},
            {
                "$pull": {"lessons": {"id": lesson_id}},
                "$inc": {"lesson_count": -1}
            }
        )
        if result.matched_count == 0:
            raise HTTPException(404, "课程不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"删除失败: {str(e)}")


@router.put("/exercises/{exercise_id}")
async def update_exercise(exercise_id: str, req: CreateExerciseRequest, current_user: dict = Depends(require_teacher)):
    """更新练习题"""
    db = get_db()
    try:
        result = await db.exercises.update_one(
            {"_id": ObjectId(exercise_id)},
            {"$set": {
                **req.exercise.dict(),
                "test_cases": [tc.dict() for tc in req.test_cases],
            }}
        )
        if result.matched_count == 0:
            raise HTTPException(404, "练习题不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"更新失败: {str(e)}")


@router.delete("/exercises/{exercise_id}")
async def delete_exercise(exercise_id: str, current_user: dict = Depends(require_teacher)):
    """删除练习题"""
    db = get_db()
    try:
        result = await db.exercises.delete_one({"_id": ObjectId(exercise_id)})
        if result.deleted_count == 0:
            raise HTTPException(404, "练习题不存在")
        return {"ok": True}
    except Exception as e:
        raise HTTPException(400, f"删除失败: {str(e)}")


# ── 用户管理 ──

class UpdateRoleRequest(BaseModel):
    role: str  # 'student' | 'teacher'


@router.get("/users")
async def list_users(current_user: dict = Depends(require_teacher)):
    db = get_db()
    users = await db.users.find({}, {"password": 0}).to_list(1000)
    return [{"id": str(u["_id"]), "username": u["username"],
             "email": u.get("email"), "role": u.get("role", "student"),
             "created_at": u.get("created_at")} for u in users]


@router.put("/users/{user_id}/role")
async def update_user_role(user_id: str, body: UpdateRoleRequest, current_user: dict = Depends(require_teacher)):
    if body.role not in ("student", "teacher"):
        raise HTTPException(400, "角色只能是 student 或 teacher")
    db = get_db()
    result = await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": body.role}})
    if result.matched_count == 0:
        raise HTTPException(404, "用户不存在")
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_teacher)):
    db = get_db()
    if str(current_user["_id"]) == user_id:
        raise HTTPException(400, "不能删除自己")
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(404, "用户不存在")
    return {"ok": True}

