from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import Optional
from core.database import get_db
from core.auth import get_current_user
from models.exercise import SubmissionIn
from services.code_analyzer import CodeAnalyzer

router = APIRouter(prefix="/api/exercises", tags=["exercises"])

# 全局分析器实例（无状态，线程安全）
_analyzer = CodeAnalyzer()


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


# 提交练习（双写 submissions + code_analytics）
@router.post("/submissions")
async def submit(body: SubmissionIn, current_user: dict = Depends(get_current_user)):
    from models.analytics import BehaviorMetadata
    
    db = get_db()
    user_id = str(current_user["_id"])
    now = datetime.utcnow()

    # ── 1. 提取行为元数据（前端可选传） ──
    behavior_data = getattr(body, 'behavior', None) or {}
    behavior = BehaviorMetadata(
        time_spent_ms=behavior_data.get("time_spent_ms", 0),
        edit_count=behavior_data.get("edit_count", 0),
        hint_used=behavior_data.get("hint_used", False),
        attempt_number=behavior_data.get("attempt_number", 1),
    )

    # ── 2. 查询此题历史提交次数（用于正确性尝试因子） ──
    existing_count = await db.submissions.count_documents({
        "user_id": user_id,
        "exercise_id": body.exercise_id,
    })
    actual_attempt = existing_count + 1
    behavior.attempt_number = actual_attempt

    # ── 3. 写入原始 submission（保持原有逻辑） ──
    submission = {
        "user_id": user_id,
        "exercise_id": body.exercise_id,
        "code": body.code,
        "passed": body.passed,
        "result": body.result,
        "submitted_at": now,
        "attempt_number": actual_attempt,
    }
    await db.submissions.insert_one(submission)

    # 通过则更新进度
    if body.passed:
        await db.progress.update_one(
            {"user_id": user_id},
            {"$addToSet": {"completed_exercises": body.exercise_id}},
            upsert=True,
        )

    # ── 4. 代码静态分析 → 写入 code_analytics（异步，不阻塞响应） ──
    try:
        # 尝试获取参考解答分析结果
        ref_analysis = None
        exercise_doc = await db.exercises.find_one(
            {"_id": ObjectId(body.exercise_id)},
            {"reference_analysis": 1}
        )
        if exercise_doc and exercise_doc.get("reference_analysis"):
            ref_analysis = exercise_doc["reference_analysis"]

        analysis_result = _analyzer.analyze(
            code_text=body.code,
            passed=body.passed,
            test_result=body.result,
            behavior=behavior,
            ref_analysis=ref_analysis,
        )

        analytics_doc = {
            "user_id": user_id,
            "exercise_id": body.exercise_id,
            "code_text": body.code,
            "passed": body.passed,
            "test_result": body.result,
            "dimensions": analysis_result["dimensions"],
            "overall_score": analysis_result["overall_score"],
            "level": analysis_result["level"],
            "behavior": behavior.model_dump(),
            "submitted_at": now,
        }
        await db.code_analytics.insert_one(analytics_doc)
    except Exception as e:
        # 分析失败不阻塞提交流程，仅记录日志
        print(f"[CodeAnalyzer] 分析失败（不影响提交）: {e}")

    return {"ok": True}
