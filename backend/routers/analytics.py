"""学习曲线分析 API 路由"""

import asyncio
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from core.database import get_db
from core.auth import get_current_user
from services.aggregator import aggregate_user_learning_curve

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# 手动刷新冷却时间（秒）
_REFRESH_COOLDOWN = 60

# 全局记录每个用户的上次刷新时间（进程内缓存）
_last_refresh: dict[str, float] = {}


@router.get("/my-curve")
async def get_my_learning_curve(current_user: dict = Depends(get_current_user)):
    """
    获取当前用户的学习曲线聚合数据
    
    返回最新的学习曲线快照，含：
      - 三维评分及趋势
      - AI 学习洞察
      - 图表数据（周趋势 + 各题分布）
      - 风险标记
    """
    db = get_db()
    user_id = str(current_user["_id"])
    
    doc = await db.learning_curve.find_one({"user_id": user_id})
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="暂无学习曲线数据。完成一些练习后再来查看吧！",
        )
    
    doc.pop("_id", None)
    return doc


@router.post("/refresh-my-curve")
async def refresh_my_learning_curve(current_user: dict = Depends(get_current_user)):
    """
    手动触发学习曲线聚合计算
    
    有 60 秒冷却时间防止频繁触发。
    实际计算是异步执行的，立即返回。
    """
    import time as _time
    from models.analytics import RefreshCurveResponse
    
    global _last_refresh
    user_id = str(current_user["_id"])
    now = _time.time()

    # 冷却检查
    last = _last_refresh.get(user_id, 0)
    if now - last < _REFRESH_COOLDOWN:
        remaining = int(_REFRESH_COOLDOWN - (now - last))
        return RefreshCurveResponse(
            ok=False,
            message=f"操作过于频繁，请等待 {remaining} 秒后再试",
        )

    _last_refresh[user_id] = now

    # 异步执行聚合（不阻塞请求）
    async def _do_aggregate():
        try:
            result = await aggregate_user_learning_curve(user_id, force=True)
            print(f"[Analytics] 用户 {user_id} 刷新曲线完成: {result}")
        except Exception as e:
            print(f"[Analytics] 用户 {user_id} 刷新曲线失败: {e}")

    asyncio.create_task(_do_aggregate())

    return RefreshCurveResponse(
        ok=True,
        message="正在分析您的学习数据，稍后刷新页面查看最新结果",
    )


@router.get("/my-curve/status")
async def get_curve_status(current_user: dict = Depends(get_current_user)):
    """
    查询学习曲线数据状态（不含完整图表数据）
    
    用于前端判断是否显示入口按钮等轻量查询。
    """
    from models.analytics import CurveStatusResponse
    
    db = get_db()
    user_id = str(current_user["_id"])
    
    count = await db.code_analytics.count_documents({"user_id": user_id})
    doc = await db.learning_curve.find_one(
        {"user_id": user_id},
        {"updated_at": 1, "overall_score": 1, "patterns": 1, "risk_flags": 1},
    )
    
    if not doc:
        return CurveStatusResponse(has_data=False, record_count=count)
    
    updated = doc.get("updated_at")
    return CurveStatusResponse(
        has_data=True,
        record_count=count,
        last_updated=updated.isoformat() if updated else None,
    )


@router.get("/my-curve/raw")
async def get_my_raw_analytics(
    limit: int = 50,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """
    获取用户的原始代码分析记录（分页）
    
    用于调试或详细查看每次提交的分析结果。
    """
    db = get_db()
    user_id = str(current_user["_id"])
    
    cursor = db.code_analytics.find(
        {"user_id": user_id},
        {"code_text": 0},  # 不返回代码文本以减小体积
    ).sort("submitted_at", -1).skip(offset).limit(limit)
    
    records = await cursor.to_list(limit)
    total = await db.code_analytics.count_documents({"user_id": user_id})
    
    for r in records:
        r["id"] = str(r.pop("_id"))
        if "submitted_at" in r:
            r["submitted_at"] = r["submitted_at"].isoformat()
    
    return {"records": records, "total": total, "limit": limit, "offset": offset}
