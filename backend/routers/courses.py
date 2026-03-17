from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from core.database import get_db
from core.auth import get_current_user

router = APIRouter(prefix="/api/courses", tags=["courses"])

# 将 MongoDB 文档 中的 _id 字段转换为普通的 id 字段（字符串类型）
def fmt(doc) -> dict:
    doc["id"] = str(doc.pop("_id"))
    return doc


# 课程列表查询
@router.get("")
async def list_courses():
    db = get_db()
    # 查询所有课程
    courses = await db.courses.find({}, {"lessons": 0}).to_list(100)
    for c in courses:
        c["id"] = str(c.pop("_id"))
        c["lesson_count"] = c.get("lesson_count", 0)    # 没有该字段，默认为 0 
    return courses


@router.get("/{course_id}")
async def get_course(course_id: str):
    db = get_db()
    try:
        doc = await db.courses.find_one({"_id": ObjectId(course_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="无效的课程ID")
    if not doc:
        raise HTTPException(status_code=404, detail="课程不存在")
    return fmt(doc)


@router.get("/{course_id}/lessons/{lesson_id}")
async def get_lesson(course_id: str, lesson_id: str):
    db = get_db()
    try:
        doc = await db.courses.find_one(
            {"_id": ObjectId(course_id)},
            {"lessons": 1}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="无效的课程ID")
    if not doc:
        raise HTTPException(status_code=404, detail="课程不存在")
    lesson = next((l for l in doc.get("lessons", []) if l["id"] == lesson_id), None)
    if not lesson:
        raise HTTPException(status_code=404, detail="章节不存在")
    return lesson
