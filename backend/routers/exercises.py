from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import Optional
from core.database import get_db
from core.auth import get_current_user
from models.exercise import SubmissionIn

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def fmt(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# 获取练习列表
@router.get("")
async def list_exercises(difficulty: Optional[str] = None, tag: Optional[str] = None):
    db = get_db()
    query = {}
    if difficulty:
        query["difficulty"] = difficulty
    if tag:
        query["tags"] = tag
    exercises = await db.exercises.find(query, {"test_cases": 0}).to_list(200)
    for e in exercises:
        e["id"] = str(e.pop("_id"))
    return exercises


@router.get("/{exercise_id}")
async def get_exercise(exercise_id: str):
    db = get_db()
    try:
        doc = await db.exercises.find_one({"_id": ObjectId(exercise_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="无效的题目ID")
    if not doc:
        raise HTTPException(status_code=404, detail="题目不存在")
    return fmt(doc)


# 提交练习
@router.post("/submissions")
async def submit(body: SubmissionIn, current_user: dict = Depends(get_current_user)):
    db = get_db()
    submission = {
        "user_id": str(current_user["_id"]),
        "exercise_id": body.exercise_id,
        "code": body.code,
        "passed": body.passed,
        "result": body.result,
        "submitted_at": datetime.utcnow(),
    }
    await db.submissions.insert_one(submission)
    # 通过则更新进度
    if body.passed:
        await db.progress.update_one(
            {"user_id": str(current_user["_id"])},
            {"$addToSet": {"completed_exercises": body.exercise_id}},
            upsert=True,
        )
    return {"ok": True}
