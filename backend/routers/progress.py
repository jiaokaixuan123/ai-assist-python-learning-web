from fastapi import APIRouter, Depends
from datetime import datetime
from core.database import get_db
from core.auth import get_current_user

router = APIRouter(prefix="/api/progress", tags=["progress"])


# 学习进展
@router.get("/me")
async def get_progress(current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(current_user["_id"])
    progress = await db.progress.find_one({"user_id": user_id})
    if not progress:
        return {"completed_courses": [], "completed_exercises": [], "study_time": 0}
    progress.pop("_id", None)
    return progress


# 完成课程/练习
@router.post("/complete")
async def mark_complete(body: dict, current_user: dict = Depends(get_current_user)):
    db = get_db()
    user_id = str(current_user["_id"])
    update = {}
    if body.get("course_id"):
        update["$addToSet"] = {"completed_courses": body["course_id"]}
    if body.get("lesson_id"):
        update.setdefault("$addToSet", {})["completed_lessons"] = body["lesson_id"]
    if body.get("study_time"):
        update["$inc"] = {"study_time": body["study_time"]}
    if update:
        await db.progress.update_one({"user_id": user_id}, update, upsert=True)
    return {"ok": True}
